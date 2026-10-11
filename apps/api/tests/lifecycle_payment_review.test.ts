import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after } from 'node:test';
import app from '../src/app';

const servers: http.Server[] = [];
let baseUrl = '';

async function startServer() {
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port');
  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const data = (await response.json().catch(() => ({}))) as any;
  return { status: response.status, data };
}

after(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
    )
  );
});

test('Full Booking Lifecycle with Payment and Review', async (t) => {
  await startServer();

  let customerToken = '';
  let proToken = '';
  let proId = '';
  let bookingId = '';
  let quoteId = '';

  await t.test('authenticates users and retrieves professional', async () => {
    const custRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@opustia.demo', password: 'demo123' })
    });
    assert.equal(custRes.status, 200);
    customerToken = custRes.data.data.accessToken;

    const proRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'pro@opustia.demo', password: 'demo123' })
    });
    assert.equal(proRes.status, 200);
    proToken = proRes.data.data.accessToken;

    const prosRes = await api('/api/professionals');
    assert.equal(prosRes.status, 200);
    const ravi = prosRes.data.data.items.find((p: { businessName: string }) => p.businessName.includes('Ravi'));
    assert.ok(ravi, 'Found Ravi professional profile');
    proId = ravi.id;
  });

  await t.test('creates booking and professional accepts', async () => {
    const createRes = await api('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Pipe Installation',
        date: '2026-11-20',
        time: '14:30',
        address: '100 Sunset Blvd',
        problem: 'New bathroom fixtures'
      })
    });
    assert.equal(createRes.status, 201);
    bookingId = createRes.data.data.id;
    assert.equal(createRes.data.data.status, 'REQUESTED');

    const acceptRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({ status: 'ACCEPTED' })
    });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.data.data.status, 'ACCEPTED');
  });

  await t.test('professional sends quote and customer approves', async () => {
    const quoteRes = await api('/api/quotes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({
        bookingId,
        labour: 750,
        parts: 250,
        additional: 0,
        discount: 50,
        description: 'Piping labour and materials',
        estimatedMinutes: 90,
        warrantyDays: 30,
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      })
    });
    assert.equal(quoteRes.status, 201);
    quoteId = quoteRes.data.data.id;
    assert.equal(quoteRes.data.data.total, 950);

    const approveRes = await api(`/api/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'ACCEPTED' })
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.data.data.status, 'ACCEPTED');

    const bookingRes = await api(`/api/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(bookingRes.data.data.status, 'CONFIRMED');
  });

  await t.test('professional travels, customer generates arrival OTP, and professional verifies', async () => {
    const travelRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({ status: 'ON_THE_WAY' })
    });
    assert.equal(travelRes.status, 200);
    assert.equal(travelRes.data.data.status, 'ON_THE_WAY');

    const otpRes = await api(`/api/bookings/${bookingId}/arrival-otp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(otpRes.status, 200);
    const otp = otpRes.data.data.otp;
    assert.ok(otp && otp.length === 6);

    const verifyRes = await api(`/api/bookings/${bookingId}/verify-otp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({ otp })
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.data.status, 'SERVICE_STARTED');
  });

  await t.test('professional completes service and booking shows COMPLETED', async () => {
    const completeRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.data.data.status, 'COMPLETED');
  });

  await t.test('customer creates and completes payment via test sandbox', async () => {
    const orderRes = await api('/api/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ bookingId, amount: 950 })
    });
    assert.equal(orderRes.status, 201);
    const paymentId = orderRes.data.data.id;
    assert.equal(orderRes.data.data.amount, 950);

    const verifyPayRes = await api('/api/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        paymentId,
        providerPaymentId: `pay_test_${Date.now()}`,
        signature: 'valid_test_signature'
      })
    });
    assert.equal(verifyPayRes.status, 200);
    assert.equal(verifyPayRes.data.data.status, 'SUCCESS');

    const bookingRes = await api(`/api/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(bookingRes.status, 200);
    assert.ok(bookingRes.data.data.payment, 'Booking contains payment details');
    assert.equal(bookingRes.data.data.payment.status, 'SUCCESS');
    assert.equal(bookingRes.data.data.payment.amount, 950);
  });

  await t.test('customer submits review and professional profile reflects reviews', async () => {
    const reviewRes = await api('/api/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        bookingId,
        rating: 5,
        comment: 'Outstanding and punctual plumbing work!'
      })
    });
    assert.equal(reviewRes.status, 201);
    assert.equal(reviewRes.data.data.rating, 5);

    const bookingRes = await api(`/api/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(bookingRes.status, 200);
    assert.ok(bookingRes.data.data.review, 'Booking contains serialized review');
    assert.equal(bookingRes.data.data.review.rating, 5);
    assert.equal(bookingRes.data.data.review.comment, 'Outstanding and punctual plumbing work!');

    const proReviewsRes = await api(`/api/professionals/${proId}/reviews`);
    assert.equal(proReviewsRes.status, 200);
    assert.ok(proReviewsRes.data.data.length > 0);
    const foundReview = proReviewsRes.data.data.find((r: { id: string }) => r.id === reviewRes.data.data.id);
    assert.ok(foundReview, 'Review appears in professional reviews endpoint');
    assert.equal(foundReview.rating, 5);
  });
});
