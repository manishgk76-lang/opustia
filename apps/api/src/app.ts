import 'dotenv/config';
import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { hashPassword, verifyPassword } from './utils/password';
import { prisma } from './db';

type Actor = { sub: string; role: 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN'; name: string; email: string };
type AuthRequest = Request & { user?: Actor };
type AsyncHandler = (req: AuthRequest, res: Response, next: NextFunction) => unknown;
const route = (handler: AsyncHandler): RequestHandler => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req as AuthRequest, res, next)).catch(next);
};
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const token = (user: { id: string; name: string; email: string; role: Actor['role'] }) =>
  jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'dev-secret', { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '1h') as SignOptions['expiresIn'] });

function auth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ success: false, message: 'Authentication required' });
  try {
    (req as AuthRequest).user = jwt.verify(header.replace(/^Bearer\s+/i, '').trim(), process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'dev-secret') as Actor;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function adminOnly(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthRequest).user?.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Administrator access required' });
  next();
}

const userSafe = (user: { id: string; name: string; email: string; role: Actor['role'] }) => ({ id: user.id, name: user.name, email: user.email, role: user.role });
const professionalInclude = { user: true, category: true } as const satisfies Prisma.ProfessionalInclude;
const bookingInclude = {
  service: { include: { category: true } },
  professional: { include: professionalInclude },
  payment: true,
  review: true,
  events: { where: { type: 'BOOKING_CANCELLED' }, take: 1, orderBy: { createdAt: 'desc' } },
} as const satisfies Prisma.BookingInclude;
type BookingWithDetails = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function serializeProfessional(
  pro: Prisma.ProfessionalGetPayload<{ include: typeof professionalInclude }>,
  userLat?: number,
  userLng?: number
) {
  let distance = 2.4;
  if (userLat != null && userLng != null && pro.latitude != null && pro.longitude != null) {
    distance = calculateHaversineDistance(userLat, userLng, pro.latitude, pro.longitude);
  }
  return {
    id: pro.id,
    name: pro.user.name,
    businessName: pro.businessName,
    rating: pro.rating,
    reviews: pro.reviewsCount,
    completedJobs: pro.completedJobs,
    onTime: pro.onTime,
    verified: pro.verified,
    category: pro.category.slug,
    distanceKm: distance,
    priceFrom: pro.priceFrom,
    description: pro.description,
    latitude: pro.latitude ?? undefined,
    longitude: pro.longitude ?? undefined,
    serviceArea: pro.serviceArea ?? 'Bengaluru',
  };
}

function serializeBooking(booking: BookingWithDetails) {
  const cancelEvent = booking.events?.[0];
  const cancelMeta = (cancelEvent?.metadata && typeof cancelEvent.metadata === 'object' && !Array.isArray(cancelEvent.metadata))
    ? (cancelEvent.metadata as Record<string, unknown>)
    : null;
  return {
    id: booking.id,
    customerId: booking.customerId,
    professionalId: booking.professionalId,
    service: booking.service.name,
    date: booking.scheduledAt.toISOString().slice(0, 10),
    time: booking.scheduledAt.toISOString().slice(11, 16),
    address: booking.address,
    latitude: booking.latitude ?? undefined,
    longitude: booking.longitude ?? undefined,
    problem: booking.problem ?? undefined,
    status: booking.status,
    cancellationReason: typeof cancelMeta?.reason === 'string' ? cancelMeta.reason : undefined,
    cancelledBy: typeof cancelMeta?.cancelledBy === 'string' ? cancelMeta.cancelledBy : undefined,
    cancelledAt: cancelEvent ? cancelEvent.createdAt.toISOString() : undefined,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    professional: booking.professional ? serializeProfessional(booking.professional) : undefined,
    payment: booking.payment ? {
      id: booking.payment.id,
      amount: booking.payment.amount,
      currency: booking.payment.currency,
      status: booking.payment.status,
      transactionId: booking.payment.transactionId ?? undefined,
      verifiedAt: booking.payment.verifiedAt ? booking.payment.verifiedAt.toISOString() : undefined,
    } : undefined,
    review: booking.review ? {
      id: booking.review.id,
      rating: booking.review.rating,
      comment: booking.review.comment ?? undefined,
      createdAt: booking.review.createdAt.toISOString(),
    } : undefined,
  };
}

async function addEvent(bookingId: string, type: string, actorId?: string, metadata?: Prisma.InputJsonValue) {
  await prisma.bookingEvent.create({ data: { bookingId, type, actorId, metadata } });
}

function canAccessBooking(actor: Actor, booking: { customerId: string; professional?: { userId: string } | null }) {
  return actor.role === 'ADMIN' || actor.sub === booking.customerId || (actor.role === 'PROFESSIONAL' && actor.sub === booking.professional?.userId);
}

app.get('/health', (_req: Request, res: Response) => res.json({ success: true, message: 'Opustia API is running' }));
app.get('/', (_req: Request, res: Response) => res.json({ success: true, name: 'Opustia API', message: 'Backend is running', health: '/health', docs: { categories: '/api/categories', professionals: '/api/professionals' } }));

app.post('/api/auth/register', route(async (req, res) => {
  const parsed = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6), role: z.enum(['CUSTOMER', 'PROFESSIONAL']).default('CUSTOMER') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid input' });
  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });
  const user = await prisma.user.create({ data: { id: randomUUID(), name: parsed.data.name, email, role: parsed.data.role, passwordHash: await hashPassword(parsed.data.password) } });
  res.status(201).json({ success: true, data: { user: userSafe(user), accessToken: token(user), refreshToken: token(user) } });
}));

app.post('/api/auth/login', route(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(String(req.body?.password ?? ''), user.passwordHash))) return res.status(401).json({ success: false, message: 'Invalid email or password' });
  res.json({ success: true, data: { user: userSafe(user), accessToken: token(user), refreshToken: token(user) } });
}));

app.get('/api/auth/me', auth, route(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  res.json({ success: true, data: { user: user ? userSafe(user) : null } });
}));

app.get('/api/categories', route(async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, icon: true } });
  res.json({ success: true, data: categories.map(({ slug, ...category }) => ({ ...category, id: slug })) });
}));

app.get('/api/professionals', route(async (req, res) => {
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const userLat = req.query.lat ? Number(req.query.lat) : undefined;
  const userLng = req.query.lng ? Number(req.query.lng) : undefined;
  const items = await prisma.professional.findMany({
    where: {
      AND: [
        search ? { OR: [{ user: { name: { contains: search, mode: 'insensitive' } } }, { businessName: { contains: search, mode: 'insensitive' } }, { category: { name: { contains: search, mode: 'insensitive' } } }] } : {},
        category ? { category: { slug: category } } : {},
      ],
    },
    include: professionalInclude,
    orderBy: [{ verified: 'desc' }, { rating: 'desc' }],
    take: 20,
  });
  const data = items.map((pro) => serializeProfessional(pro, userLat, userLng));
  if (userLat != null && userLng != null) {
    data.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  res.json({ success: true, data: { items: data, total: data.length, page: 1, pageSize: 20 } });
}));

app.get('/api/professionals/:id', route(async (req, res) => {
  const id = String(req.params.id);
  const pro = await prisma.professional.findFirst({ where: { OR: [{ id }, { userId: id }] }, include: professionalInclude });
  if (!pro) return res.status(404).json({ success: false, message: 'Professional not found' });
  res.json({ success: true, data: serializeProfessional(pro) });
}));

app.get('/api/professionals/:id/reviews', route(async (req, res) => {
  const id = String(req.params.id);
  const pro = await prisma.professional.findFirst({ where: { OR: [{ id }, { userId: id }] } });
  if (!pro) return res.status(404).json({ success: false, message: 'Professional not found' });
  const reviews = await prisma.review.findMany({
    where: { professionalId: pro.id },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json({
    success: true,
    data: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment ?? '',
      createdAt: r.createdAt.toISOString(),
      customerName: r.customer?.name || 'Customer',
    })),
  });
}));

app.post('/api/bookings', auth, route(async (req, res) => {
  const actor = req.user!;
  if (actor.role !== 'CUSTOMER') return res.status(403).json({ success: false, message: 'Customers only' });
  const parsed = z.object({
    professionalId: z.string(),
    service: z.string().min(2),
    date: z.string(),
    time: z.string(),
    address: z.string().min(5),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    problem: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid booking details' });
  const schedule = new Date(`${parsed.data.date}T${parsed.data.time}:00.000Z`);
  if (!Number.isFinite(schedule.getTime())) return res.status(400).json({ success: false, message: 'Invalid booking date or time' });
  const professional = await prisma.professional.findUnique({ where: { id: parsed.data.professionalId } });
  if (!professional) return res.status(404).json({ success: false, message: 'Professional not found' });
  if (parsed.data.idempotencyKey) {
    const previous = await prisma.booking.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey }, include: bookingInclude });
    if (previous && previous.customerId !== actor.sub) return res.status(409).json({ success: false, message: 'Idempotency key already used' });
    if (previous) return res.json({ success: true, data: serializeBooking(previous) });
  }
  const conflict = await prisma.booking.findFirst({ where: { professionalId: professional.id, scheduledAt: schedule, status: { notIn: ['CANCELLED', 'COMPLETED'] } } });
  if (conflict) return res.status(409).json({ success: false, message: 'That time is no longer available' });
  const category = await prisma.category.findUniqueOrThrow({ where: { id: professional.categoryId } });
  const booking = await prisma.$transaction(async (tx) => {
    const service = await tx.service.upsert({ where: { categoryId_name: { categoryId: category.id, name: parsed.data.service } }, update: {}, create: { name: parsed.data.service, categoryId: category.id } });
    const created = await tx.booking.create({
      data: {
        id: randomUUID(),
        customerId: actor.sub,
        professionalId: professional.id,
        serviceId: service.id,
        scheduledAt: schedule,
        address: parsed.data.address,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        problem: parsed.data.problem,
        idempotencyKey: parsed.data.idempotencyKey,
      },
      include: bookingInclude,
    });
    await tx.bookingEvent.create({ data: { bookingId: created.id, actorId: actor.sub, type: 'BOOKING_REQUESTED' } });
    await tx.notification.create({ data: { userId: professional.userId, title: 'New booking request', bookingId: created.id } });
    return created;
  });
  res.status(201).json({ success: true, data: serializeBooking(booking) });
}));

app.get('/api/bookings', auth, route(async (req, res) => {
  const actor = req.user!;
  const where: Prisma.BookingWhereInput = actor.role === 'ADMIN' ? {} : actor.role === 'CUSTOMER' ? { customerId: actor.sub } : { professional: { userId: actor.sub } };
  const bookings = await prisma.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: bookings.map(serializeBooking) });
}));

app.get('/api/bookings/:id', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: { ...bookingInclude, customer: true } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Booking access denied' });
  res.json({ success: true, data: serializeBooking(booking) });
}));

app.patch('/api/bookings/:id/status', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: bookingInclude });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  const actor = req.user!;
  const isCustomer = actor.sub === booking.customerId;
  const isPro = actor.role === 'PROFESSIONAL' && actor.sub === booking.professional?.userId;
  if (!isCustomer && !isPro && actor.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Booking access denied' });
  const transitions: Record<string, string[]> = {
    REQUESTED: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['ON_THE_WAY', 'CANCELLED'],
    ON_THE_WAY: ['ARRIVED', 'CANCELLED'],
    ARRIVED: ['SERVICE_STARTED'],
    SERVICE_STARTED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: []
  };
  const nextStatus = req.body?.status;
  if (!transitions[booking.status]?.includes(nextStatus)) return res.status(409).json({ success: false, message: `Cannot move ${booking.status} to ${nextStatus}` });
  if (nextStatus === 'ACCEPTED' && !isPro && actor.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the professional can accept' });
  if (nextStatus === 'CANCELLED') {
    if (!isCustomer && !isPro && actor.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Unauthorized to cancel this booking' });
    if (booking.status === 'ON_THE_WAY' && !isCustomer && actor.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the customer or administrator can cancel while en route' });
  }

  await prisma.$transaction(async (tx) => {
    if (nextStatus === 'CANCELLED') {
      const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'No reason provided';
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED', arrivalOtpHash: null, otpExpiresAt: null }
      });
      await tx.quote.updateMany({
        where: { bookingId: booking.id, status: 'PENDING' },
        data: { status: 'REJECTED', resolvedAt: new Date() }
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          actorId: actor.sub,
          type: 'BOOKING_CANCELLED',
          metadata: { reason, cancelledBy: actor.role, actorName: actor.name }
        }
      });
      if (isCustomer) {
        if (booking.professional?.userId) {
          await tx.notification.create({
            data: { userId: booking.professional.userId, bookingId: booking.id, title: `Booking cancelled by customer: ${reason}` }
          });
        }
      } else if (isPro) {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            bookingId: booking.id,
            title: booking.status === 'REQUESTED' ? `Booking request declined: ${reason}` : `Booking cancelled by professional: ${reason}`
          }
        });
      } else if (actor.role === 'ADMIN') {
        await tx.notification.create({
          data: { userId: booking.customerId, bookingId: booking.id, title: `Booking cancelled by administrator: ${reason}` }
        });
        if (booking.professional?.userId) {
          await tx.notification.create({
            data: { userId: booking.professional.userId, bookingId: booking.id, title: `Booking cancelled by administrator: ${reason}` }
          });
        }
      }
    } else {
      await tx.booking.update({ where: { id: booking.id }, data: { status: nextStatus } });
      await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: actor.sub, type: `BOOKING_${nextStatus}` } });
    }
  });

  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  res.json({ success: true, data: serializeBooking(updated) });
}));

app.get('/api/bookings/:id/timeline', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: { professional: true } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Booking access denied' });
  const events = await prisma.bookingEvent.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'asc' } });
  res.json({ success: true, data: events.map((event) => ({ id: event.id, bookingId: event.bookingId, type: event.type, at: event.createdAt.toISOString(), metadata: event.metadata ?? undefined })) });
}));

app.get('/api/bookings/:id/invoice', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: String(req.params.id) },
    include: {
      ...bookingInclude,
      customer: true,
    },
  });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Booking access denied' });

  const quote = await prisma.quote.findFirst({
    where: { bookingId: booking.id, status: 'ACCEPTED' },
    orderBy: { createdAt: 'desc' },
  }) || await prisma.quote.findFirst({
    where: { bookingId: booking.id },
    orderBy: { createdAt: 'desc' },
  });

  const rawTotal = booking.payment?.amount || quote?.total || 499;
  const taxableAmount = Math.round((rawTotal / 1.18) * 100) / 100;
  const cgst = Math.round((taxableAmount * 0.09) * 100) / 100;
  const sgst = Math.round((taxableAmount * 0.09) * 100) / 100;
  const totalAmount = rawTotal;

  const labour = quote?.labour || taxableAmount;
  const parts = quote?.parts || 0;
  const discount = quote?.discount || 0;
  const warrantyDays = quote?.warrantyDays || 30;

  const invoiceDate = (booking.payment?.verifiedAt || booking.updatedAt || booking.createdAt).toISOString();
  const warrantyExpiryDate = new Date(new Date(invoiceDate).getTime() + warrantyDays * 24 * 60 * 60 * 1000);
  const warrantyExpiresAt = warrantyExpiryDate.toISOString();
  const warrantyValidUntilStr = warrantyExpiryDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lineItems = [
    {
      description: `${booking.service.name} - Service & Labour Charges`,
      sacCode: '998719',
      sac: '998719',
      amount: labour,
    },
  ];

  if (parts > 0) {
    lineItems.push({
      description: 'Replacement Spares & Materials',
      sacCode: '998729',
      sac: '998729',
      amount: parts,
    });
  }

  if (discount > 0) {
    lineItems.push({
      description: 'Promotional Discount Applied',
      sacCode: '998719',
      sac: '998719',
      amount: -discount,
    });
  }

  const invoiceData = {
    invoiceNumber: `INV-2026-${booking.id.slice(0, 8).toUpperCase()}`,
    invoiceDate,
    date: invoiceDate,
    bookingId: booking.id,
    serviceName: booking.service.name,
    company: {
      name: 'Opustia Technologies India Pvt Ltd',
      gstin: '29AAFCO1234M1Z5',
      address: '100ft Road, Indiranagar, Bengaluru, Karnataka - 560038',
      email: 'billing@opustia.com',
    },
    customer: {
      id: booking.customer.id,
      name: booking.customer.name,
      email: booking.customer.email,
      address: booking.address,
      phone: '+91 98765 43210',
    },
    professional: {
      id: booking.professional?.id || 'pro_1',
      name: booking.professional?.user.name || 'Verified Professional',
      businessName: booking.professional?.businessName || booking.professional?.user.name || 'Opustia Certified Partner',
      category: booking.service.category?.name || 'Home Services',
      serviceArea: booking.professional?.serviceArea || 'Bengaluru',
    },
    lineItems,
    items: lineItems,
    labour,
    parts,
    discount,
    taxableAmount,
    subtotal: taxableAmount,
    cgst,
    sgst,
    total: totalAmount,
    totalAmount,
    payment: {
      id: booking.payment?.id || 'pending_payment',
      transactionId: booking.payment?.transactionId || 'OPUSTIA_SANDBOX_TXN',
      status: booking.payment?.status || (booking.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING'),
      verifiedAt: booking.payment?.verifiedAt ? booking.payment.verifiedAt.toISOString() : invoiceDate,
    },
    warranty: {
      days: warrantyDays,
      validUntil: warrantyValidUntilStr,
      expiresAt: warrantyExpiresAt,
    },
    warrantyDays,
    warrantyExpiresAt,
  };

  res.json({ success: true, data: invoiceData });
}));

app.post('/api/quotes', auth, route(async (req, res) => {
  if (req.user!.role !== 'PROFESSIONAL') return res.status(403).json({ success: false, message: 'Professionals only' });
  const parsed = z.object({ bookingId: z.string(), labour: z.number().nonnegative(), parts: z.number().nonnegative().default(0), additional: z.number().nonnegative().default(0), discount: z.number().nonnegative().default(0), description: z.string().min(3), estimatedMinutes: z.number().int().positive(), warrantyDays: z.number().int().nonnegative().default(0), expiresAt: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid quote' });
  const booking = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { professional: true } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (booking.professional?.userId !== req.user!.sub) return res.status(403).json({ success: false, message: 'Booking access denied' });
  const createdAt = new Date();
  const quote = await prisma.$transaction(async (tx) => {
    await tx.quote.updateMany({ where: { bookingId: booking.id, status: 'PENDING' }, data: { status: 'REJECTED', resolvedAt: createdAt } });
    const { bookingId: _bookingId, expiresAt, ...quoteFields } = parsed.data;
    const result = await tx.quote.create({ data: { id: randomUUID(), bookingId: booking.id, ...quoteFields, expiresAt: new Date(expiresAt), total: parsed.data.labour + parsed.data.parts + parsed.data.additional - parsed.data.discount } });
    await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: req.user!.sub, type: 'QUOTE_SENT', metadata: { quoteId: result.id } } });
    await tx.notification.create({ data: { userId: booking.customerId, title: 'New quote received', bookingId: booking.id } });
    return result;
  });
  res.status(201).json({ success: true, data: quote });
}));

app.get('/api/quotes', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.query.bookingId || '') }, include: { professional: true } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Quote access denied' });
  const quotes = await prisma.quote.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: quotes });
}));

app.patch('/api/quotes/:id', auth, route(async (req, res) => {
  const quote = await prisma.quote.findUnique({ where: { id: String(req.params.id) }, include: { booking: true } });
  if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
  if (quote.status !== 'PENDING') return res.status(409).json({ success: false, message: 'Quote already resolved' });
  if (quote.expiresAt < new Date()) return res.status(409).json({ success: false, message: 'Quote expired' });
  if (req.user!.sub !== quote.booking.customerId && req.user!.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Only the customer can resolve a quote' });
  const status = z.enum(['ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUESTED']).safeParse(req.body?.status);
  if (!status.success) return res.status(400).json({ success: false, message: 'Invalid quote status' });
  const resolvedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.update({ where: { id: quote.id }, data: { status: status.data, resolvedAt } });
    if (status.data === 'ACCEPTED') {
      await tx.booking.update({ where: { id: quote.bookingId }, data: { status: 'CONFIRMED' } });
      await tx.bookingEvent.create({ data: { bookingId: quote.bookingId, actorId: req.user!.sub, type: 'QUOTE_ACCEPTED', metadata: { quoteId: quote.id } } });
    }
    return updated;
  });
  res.json({ success: true, data: result });
}));

app.post('/api/bookings/:id/arrival-otp', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (req.user!.sub !== booking.customerId) return res.status(403).json({ success: false, message: 'Only the customer can generate OTP' });
  if (!['CONFIRMED', 'ON_THE_WAY'].includes(booking.status)) return res.status(409).json({ success: false, message: 'OTP is available after confirmation' });
  const otp = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.booking.update({ where: { id: booking.id }, data: { arrivalOtpHash: createHash('sha256').update(otp).digest('hex'), otpExpiresAt: expiresAt } });
  res.json({ success: true, data: { otp, expiresAt: expiresAt.toISOString() } });
}));

app.post('/api/bookings/:id/verify-otp', auth, route(async (req, res) => {
  if (req.user!.role !== 'PROFESSIONAL' && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Only the assigned professional can verify arrival OTP. Please log in as the professional.' });
  }
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: { professional: true } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (req.user!.role !== 'ADMIN' && booking.professional?.userId !== req.user!.sub) {
    return res.status(403).json({ success: false, message: 'Only the assigned professional can verify this booking' });
  }
  const supplied = createHash('sha256').update(String(req.body?.otp || '')).digest('hex');
  if (!booking.arrivalOtpHash || booking.arrivalOtpHash !== supplied || !booking.otpExpiresAt || booking.otpExpiresAt < new Date()) {
    return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
  }
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { status: 'SERVICE_STARTED', arrivalOtpHash: null, otpExpiresAt: null } });
    await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: req.user!.sub, type: 'OTP_VERIFIED' } });
    await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: req.user!.sub, type: 'SERVICE_STARTED' } });
  });
  res.json({ success: true, data: { status: 'SERVICE_STARTED' } });
}));

app.post('/api/reviews', auth, route(async (req, res) => {
  if (req.user!.role !== 'CUSTOMER') return res.status(403).json({ success: false, message: 'Customers only' });
  const parsed = z.object({ bookingId: z.string(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Rating must be 1 to 5' });
  const booking = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { professional: true } });
  if (!booking || booking.customerId !== req.user!.sub || booking.status !== 'COMPLETED' || !booking.professionalId) return res.status(409).json({ success: false, message: 'Only completed bookings can be reviewed' });
  if (await prisma.review.findUnique({ where: { bookingId: booking.id } })) return res.status(409).json({ success: false, message: 'Booking already reviewed' });
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({ data: { id: randomUUID(), bookingId: booking.id, customerId: req.user!.sub, professionalId: booking.professionalId!, rating: parsed.data.rating, comment: parsed.data.comment } });
    const stats = await tx.review.aggregate({ where: { professionalId: booking.professionalId! }, _avg: { rating: true }, _count: { _all: true } });
    await tx.professional.update({ where: { id: booking.professionalId! }, data: { rating: stats._avg.rating || 0, reviewsCount: stats._count._all } });
    await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: req.user!.sub, type: 'REVIEW_SUBMITTED' } });
    return created;
  });
  res.status(201).json({ success: true, data: { ...review, verifiedBooking: true } });
}));

app.post('/api/favorites', auth, route(async (req, res) => {
  if (req.user!.role !== 'CUSTOMER') return res.status(403).json({ success: false, message: 'Customers only' });
  const professionalId = String(req.body?.professionalId || '');
  const professional = await prisma.professional.findUnique({ where: { id: professionalId } });
  if (!professional) return res.status(404).json({ success: false, message: 'Professional not found' });
  await prisma.favorite.upsert({ where: { userId_professionalId: { userId: req.user!.sub, professionalId } }, update: {}, create: { userId: req.user!.sub, professionalId } });
  const favorites = await prisma.favorite.findMany({ where: { userId: req.user!.sub }, include: { professional: { include: professionalInclude } } });
  res.status(201).json({ success: true, data: favorites.map((favorite) => ({ userId: favorite.userId, professionalId: favorite.professionalId })) });
}));

app.delete('/api/favorites/:professionalId', auth, route(async (req, res) => {
  await prisma.favorite.deleteMany({ where: { userId: req.user!.sub, professionalId: String(req.params.professionalId) } });
  const favorites = await prisma.favorite.findMany({ where: { userId: req.user!.sub }, select: { userId: true, professionalId: true } });
  res.json({ success: true, data: favorites });
}));

app.get('/api/favorites', auth, route(async (req, res) => {
  const favorites = await prisma.favorite.findMany({ where: { userId: req.user!.sub }, include: { professional: { include: professionalInclude } } });
  res.json({ success: true, data: favorites.map(({ professional }) => serializeProfessional(professional)) });
}));

app.post('/api/disputes', auth, route(async (req, res) => {
  const parsed = z.object({ bookingId: z.string(), reason: z.enum(['NO_SHOW', 'PRICING', 'POOR_SERVICE', 'WRONG_SERVICE', 'PROPERTY_DAMAGE', 'PAYMENT', 'FRAUD', 'ABUSE', 'OTHER']), description: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid dispute' });
  const booking = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { professional: true } });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Booking access denied' });
  const dispute = await prisma.$transaction(async (tx) => {
    const created = await tx.dispute.create({ data: { id: randomUUID(), bookingId: booking.id, reporterId: req.user!.sub, reason: parsed.data.reason, description: parsed.data.description } });
    await tx.booking.update({ where: { id: booking.id }, data: { status: 'DISPUTED' } });
    await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: req.user!.sub, type: 'DISPUTE_OPENED', metadata: { disputeId: created.id } } });
    return created;
  });
  res.status(201).json({ success: true, data: dispute });
}));

app.get('/api/disputes', auth, route(async (req, res) => {
  const disputes = await prisma.dispute.findMany({
    where: { reporterId: req.user!.sub }, orderBy: { createdAt: 'desc' }, include: { booking: { include: { service: true } } }
  });
  res.json({ success: true, data: disputes.map((dispute) => ({
    id: dispute.id, bookingId: dispute.bookingId, service: dispute.booking.service.name,
    reason: dispute.reason, description: dispute.description, status: dispute.status,
    createdAt: dispute.createdAt.toISOString()
  })) });
}));


// ============================================================================
// MARKETPLACE STANDARD RATE CARDS & SERVICE BENCHMARKS
// ============================================================================
const RATE_CARDS = [
  {
    category: 'plumbing',
    categoryName: 'Plumbing',
    icon: '🔧',
    description: 'Licensed plumbers for leak repairs, fixtures, and piping',
    items: [
      { id: 'plumb-1', name: 'Tap & Mixer Repair / Replacement', price: 149, timeMins: 30, inclusions: 'Inspection, washer/spindle fixing, flow testing' },
      { id: 'plumb-2', name: 'Washbasin & Sink Blockage Removal', price: 249, timeMins: 45, inclusions: 'Waste pipe cleaning, chemical flush, leak inspection' },
      { id: 'plumb-3', name: 'Flush Tank / Cistern Overhaul', price: 299, timeMins: 45, inclusions: 'Ball valve check, inlet pipe repair, siphon tuning' },
      { id: 'plumb-4', name: 'Water Motor / Pressure Pump Service', price: 499, timeMins: 60, inclusions: 'Wiring check, airlock release, impeller diagnostic' },
      { id: 'plumb-5', name: 'Complete Bathroom Pipeline Inspection', price: 349, timeMins: 60, inclusions: 'Pressure testing, concealed dampness trace, joint sealing' }
    ]
  },
  {
    category: 'electrical',
    categoryName: 'Electrical',
    icon: '⚡',
    description: 'Government-certified electricians for wiring, fixtures, and appliances',
    items: [
      { id: 'elec-1', name: 'Switchboard / Socket Repair or Replace', price: 99, timeMins: 20, inclusions: 'Terminal connection check, earthing verification, faceplate fitting' },
      { id: 'elec-2', name: 'Ceiling Fan Installation / Regulator Fix', price: 179, timeMins: 30, inclusions: 'Canopy balancing, downrod mounting, speed check' },
      { id: 'elec-3', name: 'MCB / Fuse Box Tripping Diagnostic', price: 249, timeMins: 40, inclusions: 'Load test, short-circuit locator, breaker reset' },
      { id: 'elec-4', name: 'Inverter & Battery Wiring Setup', price: 449, timeMins: 60, inclusions: 'Terminal grease, acid level check, backup loop testing' },
      { id: 'elec-5', name: 'Decorative Chandelier / Hanging Light Fit', price: 399, timeMins: 45, inclusions: 'Ceiling anchor fixing, wire concealment, switch test' }
    ]
  },
  {
    category: 'ac-repair',
    categoryName: 'AC Service & Repair',
    icon: '❄️',
    description: 'HVAC technicians for jet foam cleaning, gas top-up, and cooling repairs',
    items: [
      { id: 'ac-1', name: 'Power Jet Foam Deep Clean Service', price: 599, timeMins: 60, inclusions: 'Indoor coil foam jet, outdoor unit wash, filter sanitization' },
      { id: 'ac-2', name: 'AC Gas Leak Check & Top-Up (R32/R410A)', price: 1499, timeMins: 60, inclusions: 'Pressure gauge analysis, brazing inspection, cooling check' },
      { id: 'ac-3', name: 'Water Leakage & Drain Pipe De-clogging', price: 349, timeMins: 40, inclusions: 'Tray flush, slope adjustment, drain line suction' },
      { id: 'ac-4', name: 'Split AC Uninstallation & Safe Packing', price: 699, timeMins: 60, inclusions: 'Gas pump-down, bracket release, copper pipe sealing' },
      { id: 'ac-5', name: 'Comprehensive Annual Maintenance (AMC)', price: 1899, timeMins: 120, inclusions: '2 jet services, 1 gas top-up, free breakdown visits' }
    ]
  },
  {
    category: 'cleaning',
    categoryName: 'Home & Deep Cleaning',
    icon: '🧹',
    description: 'Eco-friendly machine scrub and hospital-grade sanitization',
    items: [
      { id: 'clean-1', name: 'Intense Bathroom Deep Cleaning', price: 449, timeMins: 60, inclusions: 'Hard water tile descaling, toilet bowl sanitizing, mirror buff' },
      { id: 'clean-2', name: 'Modular Kitchen Degreasing & Scrub', price: 899, timeMins: 90, inclusions: 'Cabinet wipe, stove/chimney surface degrease, tile steaming' },
      { id: 'clean-3', name: 'Fabric Sofa Shampooing (3-Seater)', price: 549, timeMins: 60, inclusions: 'Wet vacuum extraction, stain treatment, odour neutralizer' },
      { id: 'clean-4', name: 'Complete 2BHK Deep Cleaning Overhaul', price: 2999, timeMins: 240, inclusions: 'Floor rotary scrubbing, balcony wash, window track clean' },
      { id: 'clean-5', name: 'Balcony & Window Mesh Pressure Wash', price: 399, timeMins: 40, inclusions: 'Dust extraction, high-pressure jet wash, rail wipe' }
    ]
  },
  {
    category: 'carpentry',
    categoryName: 'Carpentry & Furniture',
    icon: '🪚',
    description: 'Expert woodwork, locks, door hinge fixing, and furniture assembly',
    items: [
      { id: 'carp-1', name: 'Door Lock / Godrej Latch Installation', price: 249, timeMins: 45, inclusions: 'Mortise chisel, cylinder alignment, strike plate fixing' },
      { id: 'carp-2', name: 'Wardrobe Hydraulic Hinge Replacement', price: 199, timeMins: 30, inclusions: 'Soft-close hinge alignment, screw tightening, door tune' },
      { id: 'carp-3', name: 'Bed / Flatpack Furniture Assembly', price: 499, timeMins: 90, inclusions: 'Structural joinery, slat placement, wobble-free anchor' },
      { id: 'carp-4', name: 'Curtain Rod / Blind Drilling & Hanging', price: 149, timeMins: 30, inclusions: 'Level gauge alignment, rawlplug anchor, bracket test' },
      { id: 'carp-5', name: 'Drawer Channel & Slider Rail Fixing', price: 229, timeMins: 40, inclusions: 'Telescopic channel mount, drawer leveling, glide test' }
    ]
  },
  {
    category: 'painting',
    categoryName: 'Painting & Wall Care',
    icon: '🎨',
    description: 'Surface preparation, moisture barrier, and premium roller finish',
    items: [
      { id: 'paint-1', name: 'Single Accent Wall Painting (up to 120 sq ft)', price: 1499, timeMins: 120, inclusions: 'Putty touchup, primer coat, 2 coats royal luxury emulsion' },
      { id: 'paint-2', name: 'Waterproofing & Moisture Dampness Sealer', price: 899, timeMins: 90, inclusions: 'Efflorescence scrape, waterproof epoxy coat, crack seal' },
      { id: 'paint-3', name: 'Full Room Paint Touchup & Scuff Removal', price: 999, timeMins: 90, inclusions: 'Nail hole putty, matching roller coat, cleanup' },
      { id: 'paint-4', name: 'Wood Polish & Door Enamel Finishing', price: 699, timeMins: 60, inclusions: 'Sanding, PU varnish/enamel coat, grain luster polish' }
    ]
  },
  {
    category: 'pest-control',
    categoryName: 'Pest Control',
    icon: '🐜',
    description: 'HACCP certified herbal gels, termite shields, and bedbug extermination',
    items: [
      { id: 'pest-1', name: 'Advanced Cockroach Herbal Gel (1-2 BHK)', price: 549, timeMins: 45, inclusions: 'Dot baiting inside cabinets, drain chemical treatment, odorless' },
      { id: 'pest-2', name: 'Bedbug Eradication Dual Treatment', price: 1199, timeMins: 60, inclusions: 'Mattress steaming, spray contact killer, 15-day follow up' },
      { id: 'pest-3', name: 'Termite Wood Infiltration Shield', price: 1499, timeMins: 90, inclusions: 'Drill-fill-seal chemical barrier along infected baseboards' },
      { id: 'pest-4', name: 'General Pest Spray (Ants, Flies, Spiders)', price: 649, timeMins: 45, inclusions: 'Baseboard perimeter misting, window perimeter shield' }
    ]
  }
];

// Available Promo Codes
const AVAILABLE_COUPONS = [
  { code: 'FIRST50', discount: 50, minOrder: 199, type: 'FLAT', description: 'Flat ₹50 off for valued customers' },
  { code: 'OPUSTIA100', discount: 100, minOrder: 400, type: 'FLAT', description: 'Flat ₹100 off on services above ₹400' },
  { code: 'FESTIVE20', percent: 20, maxDiscount: 200, minOrder: 300, type: 'PERCENT', description: '20% discount up to ₹200' },
  { code: 'CLEAN150', discount: 150, minOrder: 600, type: 'FLAT', description: 'Flat ₹150 off on home cleaning & pest care' }
];

app.get('/api/rate-cards', route(async (req, res) => {
  const category = String(req.query.category || '').trim();
  if (category) {
    const matched = RATE_CARDS.find((c) => c.category === category);
    if (!matched) return res.status(404).json({ success: false, message: 'Category rate card not found' });
    return res.json({ success: true, data: matched });
  }
  res.json({ success: true, data: RATE_CARDS });
}));

app.patch('/api/bookings/:id/reschedule', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: bookingInclude });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  const actor = req.user!;
  if (actor.sub !== booking.customerId && actor.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Only the customer can reschedule this booking' });
  }
  if (!['REQUESTED', 'ACCEPTED', 'CONFIRMED'].includes(booking.status)) {
    return res.status(409).json({
      success: false,
      message: `Cannot reschedule a booking that is ${booking.status.replace('_', ' ')}. Rescheduling is available before dispatch.`
    });
  }
  const parsed = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
    reason: z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid reschedule date or time format' });

  const newSchedule = new Date(`${parsed.data.date}T${parsed.data.time}:00.000Z`);
  if (!Number.isFinite(newSchedule.getTime())) return res.status(400).json({ success: false, message: 'Invalid calendar date' });

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: { scheduledAt: newSchedule }
    });
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        actorId: actor.sub,
        type: 'BOOKING_RESCHEDULED',
        metadata: {
          previousDate: booking.scheduledAt.toISOString().slice(0, 10),
          previousTime: booking.scheduledAt.toISOString().slice(11, 16),
          newDate: parsed.data.date,
          newTime: parsed.data.time,
          reason: parsed.data.reason || 'Customer requested new time slot'
        }
      }
    });
    if (booking.professional?.userId) {
      await tx.notification.create({
        data: {
          userId: booking.professional.userId,
          bookingId: booking.id,
          title: `Booking rescheduled to ${parsed.data.date} at ${parsed.data.time}`
        }
      });
    }
  });

  const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  res.json({
    success: true,
    data: serializeBooking(refreshed),
    message: `Booking successfully rescheduled to ${parsed.data.date} at ${parsed.data.time}`
  });
}));

app.post('/api/coupons/validate', auth, route(async (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const rawAmount = Number(req.body?.amount || 0);
  if (!code) return res.status(400).json({ success: false, message: 'Please enter a coupon code' });
  if (rawAmount <= 0) return res.status(400).json({ success: false, message: 'Order amount required for discount calculation' });

  const coupon = AVAILABLE_COUPONS.find((c) => c.code === code);
  if (!coupon) return res.status(404).json({ success: false, message: `Coupon "${code}" is invalid or expired` });

  if (rawAmount < coupon.minOrder) {
    return res.status(400).json({ success: false, message: `Coupon requires a minimum order value of ₹${coupon.minOrder}` });
  }

  let discountAmount = 0;
  if (coupon.type === 'FLAT') {
    discountAmount = Math.min(coupon.discount || 0, rawAmount);
  } else if (coupon.type === 'PERCENT') {
    const rawDiscount = (rawAmount * (coupon.percent || 0)) / 100;
    discountAmount = Math.min(rawDiscount, coupon.maxDiscount || rawDiscount);
  }
  discountAmount = Math.round(discountAmount);
  const payableAmount = Math.max(0, rawAmount - discountAmount);

  res.json({
    success: true,
    data: {
      code: coupon.code,
      discount: discountAmount,
      payableAmount,
      description: coupon.description,
      minOrder: coupon.minOrder
    }
  });
}));

app.post('/api/bookings/:id/sos', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: bookingInclude });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Booking access denied' });

  const latitude = req.body?.latitude ?? booking.latitude;
  const longitude = req.body?.longitude ?? booking.longitude;
  const emergencyNotes = typeof req.body?.notes === 'string' ? req.body.notes : 'Emergency SOS triggered from live tracker';

  await prisma.$transaction(async (tx) => {
    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        actorId: req.user!.sub,
        type: 'SAFETY_SOS_TRIGGERED',
        metadata: {
          latitude,
          longitude,
          emergencyNotes,
          triggeredBy: req.user!.role,
          actorName: req.user!.name,
          timestamp: new Date().toISOString()
        }
      }
    });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN' } });
    for (const admin of admins) {
      await tx.notification.create({
        data: {
          userId: admin.id,
          bookingId: booking.id,
          title: `🚨 EMERGENCY SOS: ${booking.service.name} (${booking.address})`
        }
      });
    }
  });

  res.json({
    success: true,
    message: 'Emergency SOS alert registered. Our 24x7 safety desk has received your coordinates.',
    data: {
      bookingId: booking.id,
      sosReference: `SOS-${booking.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      emergencyContacts: [
        { name: 'National Emergency / Police Dispatch', number: '112', type: 'POLICE' },
        { name: 'National Women Safety Helpline', number: '1091', type: 'WOMEN_SAFETY' },
        { name: 'Opustia Rapid Response Team', number: '1800-889-OPUS', type: 'COMPANY_HOTLINE' }
      ]
    }
  });
}));

app.post('/api/payments/create-order', auth, route(async (req, res) => {
  const booking = await prisma.booking.findFirst({ where: { id: String(req.body?.bookingId || ''), customerId: req.user!.sub } });
  if (!booking || booking.status !== 'COMPLETED') return res.status(409).json({ success: false, message: 'Payment is available after completion' });
  let amount = Number(req.body?.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid payment amount' });
  const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : undefined;
  if (couponCode) {
    const coupon = AVAILABLE_COUPONS.find((c) => c.code === couponCode);
    if (coupon && amount >= coupon.minOrder) {
      const discount = coupon.type === 'FLAT' ? coupon.discount : Math.min((amount * (coupon.percent || 0)) / 100, coupon.maxDiscount || 9999);
      amount = Math.max(1, Math.round(amount - (discount || 0)));
    }
  }
  const existing = await prisma.payment.findUnique({ where: { bookingId: booking.id } });
  if (existing) return res.json({ success: true, data: existing });
  const payment = await prisma.payment.create({ data: { id: randomUUID(), bookingId: booking.id, amount, provider: 'razorpay-test' } });
  res.status(201).json({ success: true, data: payment });
}));

app.post('/api/payments/verify', auth, route(async (req, res) => {
  const payment = await prisma.payment.findUnique({ where: { id: String(req.body?.paymentId || '') }, include: { booking: true } });
  if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
  if (payment.booking.customerId !== req.user!.sub && req.user!.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Payment access denied' });
  if (payment.status === 'SUCCESS') return res.json({ success: true, data: payment });
  if (!req.body?.providerPaymentId || !req.body?.signature) return res.status(400).json({ success: false, message: 'Provider verification fields required' });
  const verifiedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS', transactionId: String(req.body.providerPaymentId), providerSignature: String(req.body.signature), verifiedAt } });
    await tx.bookingEvent.create({ data: { bookingId: payment.bookingId, actorId: req.user!.sub, type: 'PAYMENT_COMPLETED' } });
    return result;
  });
  res.json({ success: true, data: updated });
}));

app.get('/api/admin/overview', auth, adminOnly, route(async (_req, res) => {
  const [professionalCount, bookingCount, pendingVerificationCount, paymentTotals, recent, pendingProfessionals, openDisputes] = await Promise.all([
    prisma.professional.count(),
    prisma.booking.count(),
    prisma.professional.count({ where: { verified: false } }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
    prisma.booking.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { ...bookingInclude, customer: true } }),
    prisma.professional.findMany({ where: { verified: false }, take: 8, orderBy: { createdAt: 'asc' }, include: professionalInclude }),
    prisma.dispute.findMany({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } }, take: 8, orderBy: { createdAt: 'desc' }, include: { booking: { include: bookingInclude }, reporter: true } }),
  ]);
  res.json({ success: true, data: {
    metrics: { professionalCount, bookingCount, pendingVerificationCount, grossMerchandiseValue: paymentTotals._sum.amount ?? 0 },
    recentBookings: recent.map((booking) => ({ ...serializeBooking(booking), customer: userSafe(booking.customer) })),
    pendingProfessionals: pendingProfessionals.map((professional) => ({ ...serializeProfessional(professional), email: professional.user.email, createdAt: professional.createdAt.toISOString() })),
    openDisputes: openDisputes.map((dispute) => ({ id: dispute.id, reason: dispute.reason, description: dispute.description, status: dispute.status, createdAt: dispute.createdAt.toISOString(), reporter: userSafe(dispute.reporter), booking: serializeBooking(dispute.booking) })),
  } });
}));

app.get('/api/admin/bookings', auth, adminOnly, route(async (_req, res) => {
  const bookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' }, include: { ...bookingInclude, customer: true } });
  res.json({ success: true, data: { items: bookings.map((booking) => ({ ...serializeBooking(booking), customer: userSafe(booking.customer) })), total: bookings.length } });
}));

app.patch('/api/admin/bookings/:id', auth, adminOnly, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: String(req.params.id) }, include: bookingInclude });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  const status = req.body?.status;
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'Administrative cancellation';
  if (status !== 'CANCELLED') return res.status(400).json({ success: false, message: 'Admin can only set status to CANCELLED' });
  if (['COMPLETED', 'CANCELLED'].includes(booking.status)) return res.status(409).json({ success: false, message: `Cannot cancel a booking that is ${booking.status}` });
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED', arrivalOtpHash: null, otpExpiresAt: null } });
    await tx.quote.updateMany({ where: { bookingId: booking.id, status: 'PENDING' }, data: { status: 'REJECTED', resolvedAt: new Date() } });
    await tx.bookingEvent.create({ data: { bookingId: booking.id, actorId: req.user!.sub, type: 'BOOKING_CANCELLED', metadata: { reason, cancelledBy: 'ADMIN', actorName: req.user!.name } } });
    await tx.notification.create({ data: { userId: booking.customerId, bookingId: booking.id, title: `Booking cancelled by administrator: ${reason}` } });
    if (booking.professional?.userId) {
      await tx.notification.create({ data: { userId: booking.professional.userId, bookingId: booking.id, title: `Booking cancelled by administrator: ${reason}` } });
    }
  });
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  res.json({ success: true, data: serializeBooking(updated) });
}));

app.get('/api/admin/professionals', auth, adminOnly, route(async (_req, res) => {
  const professionals = await prisma.professional.findMany({ orderBy: { createdAt: 'desc' }, include: professionalInclude });
  res.json({ success: true, data: { items: professionals.map((professional) => ({ ...serializeProfessional(professional), email: professional.user.email, createdAt: professional.createdAt.toISOString() })), total: professionals.length } });
}));

app.patch('/api/admin/professionals/:id', auth, adminOnly, route(async (req, res) => {
  const parsed = z.object({ verified: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Provide a verified boolean' });
  const professional = await prisma.professional.update({ where: { id: String(req.params.id) }, data: { verified: parsed.data.verified }, include: professionalInclude });
  res.json({ success: true, data: { ...serializeProfessional(professional), email: professional.user.email, createdAt: professional.createdAt.toISOString() } });
}));

app.get('/api/admin/disputes', auth, adminOnly, route(async (_req, res) => {
  const disputes = await prisma.dispute.findMany({ orderBy: { createdAt: 'desc' }, include: { booking: { include: bookingInclude }, reporter: true } });
  res.json({ success: true, data: { items: disputes.map((dispute) => ({ id: dispute.id, reason: dispute.reason, description: dispute.description, status: dispute.status, createdAt: dispute.createdAt.toISOString(), reporter: userSafe(dispute.reporter), booking: serializeBooking(dispute.booking) })), total: disputes.length } });
}));

app.patch('/api/admin/disputes/:id', auth, adminOnly, route(async (req, res) => {
  const parsed = z.object({ status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid dispute status' });
  const dispute = await prisma.dispute.update({ where: { id: String(req.params.id) }, data: { status: parsed.data.status } });
  if (parsed.data.status === 'RESOLVED') await prisma.notification.create({ data: { userId: dispute.reporterId, bookingId: dispute.bookingId, title: 'Your support case has been resolved' } });
  res.json({ success: true, data: dispute });
}));

app.get('/api/notifications', auth, route(async (req, res) => {
  const notifications = await prisma.notification.findMany({ where: { userId: req.user!.sub }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: notifications });
}));

app.patch('/api/notifications/:id/read', auth, route(async (req, res) => {
  const notif = await prisma.notification.findUnique({ where: { id: String(req.params.id) } });
  if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
  if (notif.userId !== req.user!.sub) return res.status(403).json({ success: false, message: 'Access denied' });

  const updated = await prisma.notification.update({
    where: { id: notif.id },
    data: { read: true },
  });
  res.json({ success: true, data: updated });
}));

app.get('/api/notifications/unread-count', auth, route(async (req, res) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.sub, read: false },
  });
  res.json({ success: true, data: { count } });
}));

app.get('/api/bookings/:id/messages', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: String(req.params.id) },
    include: { professional: true },
  });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Access denied' });

  const messages = await prisma.bookingMessage.findMany({
    where: { bookingId: booking.id },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    success: true,
    data: messages.map((m) => ({
      id: m.id,
      bookingId: m.bookingId,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderRole: m.sender.role,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
      isMe: m.senderId === req.user!.sub,
    })),
  });
}));

app.post('/api/bookings/:id/messages', auth, route(async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ success: false, message: 'Message text cannot be empty' });

  const booking = await prisma.booking.findUnique({
    where: { id: String(req.params.id) },
    include: { professional: true, customer: true },
  });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Access denied' });

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.bookingMessage.create({
      data: {
        id: randomUUID(),
        bookingId: booking.id,
        senderId: req.user!.sub,
        text,
      },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });

    const isCustomer = req.user!.sub === booking.customerId;
    const recipientId = isCustomer ? booking.professional?.userId : booking.customerId;
    if (recipientId) {
      await tx.notification.create({
        data: {
          userId: recipientId,
          bookingId: booking.id,
          title: `New message from ${req.user!.name}: "${text.length > 40 ? text.slice(0, 37) + '...' : text}"`,
        },
      });
    }
    return created;
  });

  res.status(201).json({
    success: true,
    data: {
      id: message.id,
      bookingId: message.bookingId,
      senderId: message.senderId,
      senderName: message.sender.name,
      senderRole: message.sender.role,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
      isMe: true,
    },
  });
}));

app.get('/api/professional/earnings', auth, route(async (req, res) => {
  if (req.user!.role !== 'PROFESSIONAL') return res.status(403).json({ success: false, message: 'Professionals only' });
  const pro = await prisma.professional.findUnique({ where: { userId: req.user!.sub } });
  if (!pro) return res.status(404).json({ success: false, message: 'Professional profile not found' });

  const payments = await prisma.payment.findMany({
    where: { booking: { professionalId: pro.id }, status: 'SUCCESS' },
    include: { booking: { select: { id: true, service: { select: { name: true } }, scheduledAt: true } } },
    orderBy: { verifiedAt: 'desc' },
  });

  const totalEarnings = payments.reduce((acc, p) => acc + p.amount, 0);

  res.json({
    success: true,
    data: {
      totalEarnings,
      completedJobs: pro.completedJobs,
      rating: pro.rating,
      reviewsCount: pro.reviewsCount,
      onTime: pro.onTime,
      transactions: payments.map((p) => ({
        id: p.id,
        bookingId: p.bookingId,
        service: p.booking.service.name,
        amount: p.amount,
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : p.createdAt.toISOString(),
        transactionId: p.transactionId,
      })),
    },
  });
}));

app.get('/api/bookings/:id/invoice', auth, route(async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: String(req.params.id) },
    include: {
      customer: true,
      professional: { include: { user: true } },
      quotes: { orderBy: { createdAt: 'desc' } },
      payment: true,
      service: true,
    },
  });
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
  if (!canAccessBooking(req.user!, booking)) return res.status(403).json({ success: false, message: 'Access denied' });

  const acceptedQuote = booking.quotes.find((q) => q.status === 'ACCEPTED') || booking.quotes[0];
  const labour = acceptedQuote?.labour ?? (booking.payment?.amount ? Math.round(booking.payment.amount * 0.85) : 499);
  const parts = acceptedQuote?.parts ?? 0;
  const discount = acceptedQuote?.discount ?? 0;
  const subtotal = Math.max(0, labour + parts - discount);

  const cgst = Math.round(subtotal * 0.09 * 100) / 100;
  const sgst = Math.round(subtotal * 0.09 * 100) / 100;
  const calculatedTotal = subtotal + cgst + sgst;
  const finalTotal = booking.payment?.amount || calculatedTotal;

  const warrantyDays = acceptedQuote?.warrantyDays || 30;
  const completionDate = booking.payment?.verifiedAt || booking.updatedAt || booking.createdAt;
  const warrantyExpiresAt = new Date(new Date(completionDate).getTime() + warrantyDays * 24 * 60 * 60 * 1000).toISOString();

  const invoiceData = {
    invoiceNumber: `INV-2026-${booking.id.slice(0, 8).toUpperCase()}`,
    invoiceDate: (booking.payment?.verifiedAt || booking.updatedAt || booking.createdAt).toISOString(),
    bookingId: booking.id,
    serviceName: booking.service.name,
    customer: {
      id: booking.customer.id,
      name: booking.customer.name,
      email: booking.customer.email,
      address: booking.address,
    },
    professional: {
      id: booking.professional?.id || 'p1',
      name: booking.professional?.user.name || 'Verified Professional',
      businessName: booking.professional?.businessName || 'Opustia Service Partner',
      serviceArea: booking.professional?.serviceArea || 'Bengaluru',
    },
    lineItems: [
      { description: `${booking.service.name} - Skilled Workmanship & Labour`, sacCode: '998719', amount: labour },
      ...(parts > 0 ? [{ description: 'Replacement Spares & Hardware Materials', sacCode: '998729', amount: parts }] : []),
      ...(discount > 0 ? [{ description: 'Promotional Welcome Discount', sacCode: '', amount: -discount }] : []),
    ],
    labour,
    parts,
    discount,
    taxableAmount: subtotal,
    cgst,
    sgst,
    totalAmount: finalTotal,
    payment: {
      id: booking.payment?.id || 'pay_verified',
      transactionId: booking.payment?.transactionId || `TXN_${booking.id.slice(0, 8).toUpperCase()}`,
      status: booking.payment?.status || (booking.status === 'COMPLETED' ? 'SUCCESS' : 'PENDING'),
      verifiedAt: booking.payment?.verifiedAt ? booking.payment.verifiedAt.toISOString() : undefined,
    },
    warrantyDays,
    warrantyExpiresAt,
  };

  res.json({ success: true, data: invoiceData });
}));

app.get('/api/support/info', route(async (_req, res) => {
  res.json({
    success: true,
    data: {
      company: {
        legalName: 'Opustia Technologies India Private Limited',
        brandName: 'Opustia',
        cin: 'U72900KA2024PTC184920',
        gstin: '29AAFCO1234M1Z5',
        registeredOffice: {
          building: '4th Floor, Salarpuria Citadel',
          street: '100 Feet Road, HAL 2nd Stage',
          locality: 'Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560038',
          country: 'India',
          fullAddress: '4th Floor, Salarpuria Citadel, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka - 560038, India',
          mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Salarpuria+Citadel+100+Feet+Road+Indiranagar+Bengaluru',
        },
        operatingCities: ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Chennai', 'Pune'],
      },
      contacts: {
        tollFree: '1800-889-OPUS (1800-889-6787)',
        directPhone: '+91 80 4567 8900',
        whatsapp: '+91 98765 43210',
        supportEmail: 'support@opustia.com',
        billingEmail: 'billing@opustia.com',
        legalEmail: 'legal@opustia.com',
        workingHours: 'Monday – Sunday, 7:00 AM – 11:00 PM IST',
        emergencySupport: '24x7 Dedicated Safety & Emergency Helpline Available',
      },
      grievanceOfficer: {
        name: 'Rajeshwar Rao',
        designation: 'Head of Trust, Safety & Grievance Redressal',
        email: 'grievance-officer@opustia.com',
        phone: '+91 80 4567 8910',
        address: 'Opustia Technologies India Pvt Ltd, 4th Floor, Salarpuria Citadel, 100 Feet Road, Indiranagar, Bengaluru - 560038',
        acknowledgementSla: 'Within 48 hours',
        resolutionSla: 'Within 30 days',
        statutoryNotice: 'Designated pursuant to Rule 5(9) of the Consumer Protection (E-Commerce) Rules, 2020 & Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.',
      },
      policies: {
        termsVersion: 'v2026.1 (Effective Jan 1, 2026)',
        privacyVersion: 'v2026.1 (DPDP Act 2023 Compliant)',
        refundVersion: 'v2026.1 (30-Day Opustia Guarantee)',
      },
    },
  });
}));

app.post('/api/support/tickets', route(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2, 'Name is required'),
    email: z.string().email('Valid email is required'),
    phone: z.string().optional(),
    category: z.enum(['BOOKING_HELP', 'PAYMENT_BILLING', 'SERVICE_QUALITY', 'SAFETY_CONDUCT', 'GRIEVANCE', 'OTHER']).default('BOOKING_HELP'),
    bookingId: z.string().optional(),
    message: z.string().min(10, 'Message must be at least 10 characters'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || 'Invalid support ticket request' });
  }

  const ticketId = `TICK-2026-${randomUUID().slice(0, 6).toUpperCase()}`;

  res.status(201).json({
    success: true,
    data: {
      ticketId,
      status: 'OPEN',
      category: parsed.data.category,
      createdAt: new Date().toISOString(),
      acknowledgement: `Thank you, ${parsed.data.name}. Your support inquiry has been received under reference #${ticketId}. Our Bangalore support desk will respond to ${parsed.data.email} within 2–4 hours.`,
    },
  });
}));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return res.status(409).json({ success: false, message: 'This record already exists' });
  console.error(err);
  return res.status(500).json({ success: false, message: 'Unexpected server error' });
});

export default app;
