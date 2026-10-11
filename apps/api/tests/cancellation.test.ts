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

test('Booking Cancellation Workflow', async (t) => {
  await startServer();

  let customerToken = '';
  let proToken = '';
  let adminToken = '';
  let proId = '';

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

    const adminRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@opustia.demo', password: 'demo123' })
    });
    assert.equal(adminRes.status, 200);
    adminToken = adminRes.data.data.accessToken;

    const prosRes = await api('/api/professionals');
    assert.equal(prosRes.status, 200);
    assert.ok(prosRes.data.data.items.length > 0);
    const ravi = prosRes.data.data.items.find((p: { businessName: string }) => p.businessName.includes('Ravi'));
    assert.ok(ravi, 'Found Ravi professional profile');
    proId = ravi.id;
  });

  await t.test('customer cancels a requested booking with reason', async () => {
    const createRes = await api('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Plumbing Inspection',
        date: '2026-12-01',
        time: '11:00',
        address: '42 Main St Apt 4B',
        problem: 'Tap leaking slightly'
      })
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.data.id;
    assert.equal(createRes.data.data.status, 'REQUESTED');

    const cancelRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        status: 'CANCELLED',
        reason: 'Change of plans'
      })
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.data.status, 'CANCELLED');
    assert.equal(cancelRes.data.data.cancellationReason, 'Change of plans');
    assert.equal(cancelRes.data.data.cancelledBy, 'CUSTOMER');
  });

  await t.test('professional declines an incoming booking request with reason', async () => {
    const createRes = await api('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Emergency Drain Unclog',
        date: '2026-12-02',
        time: '14:00',
        address: '99 Side Ave',
        problem: 'Pipe leak under sink'
      })
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.data.id;

    const declineRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({
        status: 'CANCELLED',
        reason: 'Schedule conflict / fully booked'
      })
    });
    assert.equal(declineRes.status, 200);
    assert.equal(declineRes.data.data.status, 'CANCELLED');
    assert.equal(declineRes.data.data.cancellationReason, 'Schedule conflict / fully booked');
    assert.equal(declineRes.data.data.cancelledBy, 'PROFESSIONAL');
  });

  await t.test('cancelling booking automatically rejects any open pending quotes', async () => {
    const createRes = await api('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Bathroom Pipe Fitting',
        date: '2026-12-03',
        time: '09:00',
        address: '100 Wood St'
      })
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.data.id;

    // Professional accepts
    const acceptRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({ status: 'ACCEPTED' })
    });
    assert.equal(acceptRes.status, 200);

    // Professional sends quote
    const quoteRes = await api('/api/quotes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({
        bookingId,
        labour: 1200,
        parts: 300,
        additional: 0,
        discount: 100,
        description: 'New pipe replacement',
        estimatedMinutes: 90,
        warrantyDays: 30,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      })
    });
    assert.equal(quoteRes.status, 201);
    const quoteId = quoteRes.data.data.id;
    assert.equal(quoteRes.data.data.status, 'PENDING');

    // Customer cancels
    const cancelRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        status: 'CANCELLED',
        reason: 'Pricing or quote too high'
      })
    });
    assert.equal(cancelRes.status, 200);

    // Verify quote is now REJECTED
    const quotesRes = await api(`/api/quotes?bookingId=${bookingId}`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(quotesRes.status, 200);
    const quote = quotesRes.data.data.find((q: { id: string }) => q.id === quoteId);
    assert.ok(quote);
    assert.equal(quote.status, 'REJECTED');
  });

  await t.test('admin can cancel an active booking via admin endpoint', async () => {
    const createRes = await api('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Water Motor Repair',
        date: '2026-12-04',
        time: '16:00',
        address: '50 Park Lane'
      })
    });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.data.data.id;

    const adminCancelRes = await api(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        status: 'CANCELLED',
        reason: 'Customer violation flag'
      })
    });
    assert.equal(adminCancelRes.status, 200);
    assert.equal(adminCancelRes.data.data.status, 'CANCELLED');
    assert.equal(adminCancelRes.data.data.cancellationReason, 'Customer violation flag');
    assert.equal(adminCancelRes.data.data.cancelledBy, 'ADMIN');
  });

  await t.test('rejects invalid cancellation transitions', async () => {
    const createRes = await api('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Shower Head Fix',
        date: '2026-12-05',
        time: '10:00',
        address: '77 Broad St'
      })
    });
    const bookingId = createRes.data.data.id;

    await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'CANCELLED' })
    });

    const reCancelRes = await api(`/api/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: 'CANCELLED' })
    });
    assert.equal(reCancelRes.status, 409);
  });
});
