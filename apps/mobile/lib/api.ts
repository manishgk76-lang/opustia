export type Category = { id: string; name: string; icon: string };
export type Professional = {
  id: string;
  name: string;
  businessName: string;
  rating: number;
  reviews: number;
  completedJobs: number;
  onTime: number;
  verified: boolean;
  category: string;
  distanceKm: number;
  priceFrom: number;
  description: string;
  latitude?: number;
  longitude?: number;
  serviceArea?: string;
};
export type SessionUser = { id: string; name: string; email: string; role: string };
export type UserLocation = {
  address: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
};
export type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  transactionId?: string;
  verifiedAt?: string;
};
export type Review = {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  customerName?: string;
};
export type Booking = {
  id: string;
  professionalId: string | null;
  service: string;
  date: string;
  time: string;
  address: string;
  latitude?: number;
  longitude?: number;
  problem?: string;
  status: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt?: string;
  payment?: Payment;
  review?: Review;
};
export type Quote = {
  id: string;
  bookingId: string;
  labour: number;
  parts: number;
  additional: number;
  discount: number;
  total: number;
  description: string;
  estimatedMinutes: number;
  warrantyDays: number;
  expiresAt: string;
  status: string;
};
export type Notification = { id: string; title: string; bookingId?: string; read: boolean; createdAt: string };
export type Dispute = { id: string; bookingId: string; service: string; reason: string; description: string; status: string; createdAt: string };
export type ChatMessage = {
  id: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  createdAt: string;
  isMe: boolean;
};
export type EarningsData = {
  totalEarnings: number;
  completedJobs: number;
  rating: number;
  reviewsCount: number;
  onTime: number;
  transactions: {
    id: string;
    bookingId: string;
    service: string;
    amount: number;
    verifiedAt: string;
    transactionId?: string;
  }[];
};
export type Invoice = {
  invoiceNumber: string;
  invoiceDate: string;
  bookingId: string;
  serviceName: string;
  customer: {
    id: string;
    name: string;
    email: string;
    address: string;
  };
  professional: {
    id: string;
    name: string;
    businessName: string;
    serviceArea: string;
  };
  lineItems: {
    description: string;
    sacCode: string;
    amount: number;
  }[];
  labour: number;
  parts: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  payment: {
    id: string;
    transactionId: string;
    status: string;
    verifiedAt?: string;
  };
  warrantyDays: number;
  warrantyExpiresAt: string;
};
export const getDisputes = (token: string) => request<Dispute[]>('/disputes', { headers: { Authorization: `Bearer ${token}` } });
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) throw new Error(body.message || 'Unable to reach Opustia');
  return body.data as T;
}
export const api = {
  getCategories: () => request<Category[]>('/categories'),
  getProfessionals: (search = '', lat?: number, lng?: number) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (lat != null && lng != null) {
      params.append('lat', String(lat));
      params.append('lng', String(lng));
    }
    const q = params.toString();
    return request<{ items: Professional[]; total: number }>(`/professionals${q ? `?${q}` : ''}`);
  },
  getProfessional: (id: string) => request<Professional>(`/professionals/${id}`),
  getProfessionalReviews: (id: string) => request<Review[]>(`/professionals/${id}/reviews`),
  login: (email: string, password: string) =>
    request<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    request<{ user: SessionUser; accessToken: string; refreshToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role: 'CUSTOMER' }) }),
  getCurrentUser: (token: string) => request<{ user: SessionUser | null }>('/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
  getFavorites: (token: string) => request<Professional[]>('/favorites', { headers: { Authorization: `Bearer ${token}` } }),
  addFavorite: (token: string, professionalId: string) =>
    request<any>('/favorites', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ professionalId }) }),
  removeFavorite: (token: string, professionalId: string) =>
    request<any>(`/favorites/${professionalId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  createBooking: (token: string, payload: { professionalId: string; service: string; date: string; time: string; address: string; latitude?: number; longitude?: number; problem?: string; idempotencyKey: string }) =>
    request<Booking>('/bookings', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  getBookings: (token: string) => request<Booking[]>('/bookings', { headers: { Authorization: `Bearer ${token}` } }),
  updateBookingStatus: (token: string, id: string, status: string, reason?: string) =>
    request<Booking>(`/bookings/${id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status, reason }) }),
  createQuote: (token: string, payload: any) => request<any>('/quotes', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }),
  getQuotes: (token: string, bookingId: string) => request<Quote[]>(`/quotes?bookingId=${encodeURIComponent(bookingId)}`, { headers: { Authorization: `Bearer ${token}` } }),
  resolveQuote: (token: string, id: string, status: 'ACCEPTED' | 'REJECTED' | 'CLARIFICATION_REQUESTED') =>
    request<Quote>(`/quotes/${id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) }),
  createArrivalOtp: (token: string, bookingId: string) => request<{ otp: string; expiresAt: string }>(`/bookings/${bookingId}/arrival-otp`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
  verifyArrivalOtp: (token: string, bookingId: string, otp: string) =>
    request<{ status: string }>(`/bookings/${bookingId}/verify-otp`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ otp }) }),
  submitReview: (token: string, bookingId: string, rating: number, comment?: string) =>
    request<any>('/reviews', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ bookingId, rating, comment }) }),
  createDispute: (token: string, bookingId: string, reason: string, description: string) =>
    request<any>('/disputes', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ bookingId, reason, description }) }),
  getNotifications: (token: string) => request<Notification[]>('/notifications', { headers: { Authorization: `Bearer ${token}` } }),
  createPaymentOrder: (token: string, bookingId: string, amount: number, couponCode?: string) =>
    request<Payment>('/payments/create-order', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ bookingId, amount, couponCode }) }),
  verifyPayment: (token: string, paymentId: string) =>
    request<Payment>('/payments/verify', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ paymentId, providerPaymentId: `test_pay_${Date.now()}`, signature: 'razorpay_test_signature' }) }),
  getBookingMessages: (token: string, bookingId: string) =>
    request<ChatMessage[]>(`/bookings/${bookingId}/messages`, { headers: { Authorization: `Bearer ${token}` } }),
  sendBookingMessage: (token: string, bookingId: string, text: string) =>
    request<ChatMessage>(`/bookings/${bookingId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) }),
  getUnreadNotificationsCount: (token: string) =>
    request<{ count: number }>('/notifications/unread-count', { headers: { Authorization: `Bearer ${token}` } }),
  markNotificationRead: (token: string, id: string) =>
    request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }),
  getProfessionalEarnings: (token: string) =>
    request<EarningsData>('/professional/earnings', { headers: { Authorization: `Bearer ${token}` } }),
  getBookingInvoice: (token: string, bookingId: string) =>
    request<Invoice>(`/bookings/${bookingId}/invoice`, { headers: { Authorization: `Bearer ${token}` } }),
  getSupportInfo: () => request<SupportInfo>('/support/info'),
  submitSupportTicket: (payload: SupportTicketPayload) =>
    request<SupportTicketResponse>('/support/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  getRateCards: (category?: string) =>
    request<RateCardCategory[]>(`/rate-cards${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  rescheduleBooking: (token: string, id: string, date: string, time: string, reason?: string) =>
    request<Booking>(`/bookings/${id}/reschedule`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ date, time, reason }) }),
  validateCoupon: (token: string, code: string, amount: number) =>
    request<CouponValidationResult>('/coupons/validate', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ code, amount }) }),
  triggerSafetySos: (token: string, bookingId: string, latitude?: number, longitude?: number, notes?: string) =>
    request<SosAlertResult>(`/bookings/${bookingId}/sos`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ latitude, longitude, notes }) }),
};

export type SupportInfo = {
  company: {
    legalName: string;
    brandName: string;
    cin: string;
    gstin: string;
    registeredOffice: {
      building: string;
      street: string;
      locality: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      fullAddress: string;
      mapsUrl: string;
    };
    operatingCities: string[];
  };
  contacts: {
    tollFree: string;
    directPhone: string;
    whatsapp: string;
    supportEmail: string;
    billingEmail: string;
    legalEmail: string;
    workingHours: string;
    emergencySupport: string;
  };
  grievanceOfficer: {
    name: string;
    designation: string;
    email: string;
    phone: string;
    address: string;
    acknowledgementSla: string;
    resolutionSla: string;
    statutoryNotice: string;
  };
  policies: {
    termsVersion: string;
    privacyVersion: string;
    refundVersion: string;
  };
};

export type SupportTicketPayload = {
  name: string;
  email: string;
  phone?: string;
  category: 'BOOKING_HELP' | 'PAYMENT_BILLING' | 'SERVICE_QUALITY' | 'SAFETY_CONDUCT' | 'GRIEVANCE' | 'OTHER';
  bookingId?: string;
  message: string;
};

export type SupportTicketResponse = {
  ticketId: string;
  status: string;
  category: string;
  createdAt: string;
  acknowledgement: string;
};

export type RateCardItem = {
  id: string;
  name: string;
  price: number;
  timeMins: number;
  inclusions: string;
};

export type RateCardCategory = {
  category: string;
  categoryName: string;
  icon: string;
  description: string;
  items: RateCardItem[];
};

export type CouponValidationResult = {
  code: string;
  discount: number;
  payableAmount: number;
  description: string;
  minOrder: number;
};

export type EmergencyContact = {
  name: string;
  number: string;
  type: string;
};

export type SosAlertResult = {
  bookingId: string;
  sosReference: string;
  timestamp: string;
  emergencyContacts: EmergencyContact[];
};

