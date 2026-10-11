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

test('Chat, Professional Earnings, and Notifications API', async (t) => {
  await startServer();

  let customerToken = '';
  let proToken = '';
  let proId = '';
  let bookingId = '';

  await t.test('authenticates customer and professional', async () => {
    const custRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'customer@opustia.demo', password: 'demo123' })
    });
    assert.equal(custRes.status, 200);
    assert.equal(custRes.data.success, true);
    customerToken = custRes.data.data.accessToken;

    const proRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'pro@opustia.demo', password: 'demo123' })
    });
    assert.equal(proRes.status, 200);
    assert.equal(proRes.data.success, true);
    proToken = proRes.data.data.accessToken;

    const prosRes = await api('/api/professionals');
    assert.equal(prosRes.status, 200);
    const ravi = prosRes.data.data.items.find((x: any) => x.name === 'Ravi Kumar') || prosRes.data.data.items[0];
    proId = ravi.id;
    assert.ok(proId);
  });

  await t.test('professional earnings endpoint aggregates metrics', async () => {
    // Pro can fetch earnings
    const earnRes = await api('/api/professional/earnings', {
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(earnRes.status, 200);
    assert.equal(earnRes.data.success, true);
    const earnings = earnRes.data.data;
    assert.equal(typeof earnings.totalEarnings, 'number');
    assert.equal(typeof earnings.completedJobs, 'number');
    assert.equal(typeof earnings.rating, 'number');
    assert.equal(typeof earnings.onTime, 'number');
    assert.ok(Array.isArray(earnings.transactions));

    // Non-pro cannot fetch earnings (returns 403)
    const custEarnRes = await api('/api/professional/earnings', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(custEarnRes.status, 403);
  });

  await t.test('calculates accurate distance based on customer coordinates', async () => {
    // Indiranagar coordinates: Ravi Kumar (p1) is in Indiranagar so distance is 0 km
    const nearRes = await api('/api/professionals?lat=12.9719&lng=77.6412');
    assert.equal(nearRes.status, 200);
    const items = nearRes.data.data.items;
    assert.ok(items.length >= 2);
    // Closest professional should have distance 0 km or near 0
    assert.equal(items[0].distanceKm, 0);
    assert.equal(items[0].id, 'p1');
    // More distant professionals should have larger distance
    assert.ok(items[1].distanceKm > 0);
  });

  await t.test('creates a booking to test chat communication and location persistence', async () => {
    const randomDay = 10 + Math.floor(Math.random() * 15);
    const randomHour = 10 + Math.floor(Math.random() * 8);
    const randomMinute = String(Math.floor(Math.random() * 50)).padStart(2, '0');
    const bookRes = await api('/api/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Pipe Repair Chat Test',
        date: `2028-05-${randomDay}`,
        time: `${randomHour}:${randomMinute}`,
        address: '100ft Road, Indiranagar, Bangalore',
        latitude: 12.9719,
        longitude: 77.6412,
        problem: 'Chat and location integration verification',
        idempotencyKey: `chat_test_${Date.now()}_${Math.random()}`
      })
    });
    assert.equal(bookRes.status, 201);
    assert.equal(bookRes.data.data.latitude, 12.9719);
    assert.equal(bookRes.data.data.longitude, 77.6412);
    bookingId = bookRes.data.data.id;
    assert.ok(bookingId);
  });

  await t.test('customer and professional exchange messages in real-time', async () => {
    // 1. Initial messages empty
    const initialMsgs = await api(`/api/bookings/${bookingId}/messages`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(initialMsgs.status, 200);
    assert.equal(initialMsgs.data.data.length, 0);

    // 2. Customer sends message
    const sendCust = await api(`/api/bookings/${bookingId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ text: 'Hello Ravi! Can you bring extra copper pipes?' })
    });
    assert.equal(sendCust.status, 201);
    assert.equal(sendCust.data.data.text, 'Hello Ravi! Can you bring extra copper pipes?');
    assert.equal(sendCust.data.data.isMe, true);
    assert.equal(sendCust.data.data.senderRole, 'CUSTOMER');

    // 3. Professional receives message
    const proMsgs = await api(`/api/bookings/${bookingId}/messages`, {
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(proMsgs.status, 200);
    assert.equal(proMsgs.data.data.length, 1);
    assert.equal(proMsgs.data.data[0].text, 'Hello Ravi! Can you bring extra copper pipes?');
    assert.equal(proMsgs.data.data[0].isMe, false);

    // 4. Professional replies
    const sendPro = await api(`/api/bookings/${bookingId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${proToken}` },
      body: JSON.stringify({ text: 'Yes, absolutely. I will carry high-grade copper fittings.' })
    });
    assert.equal(sendPro.status, 201);
    assert.equal(sendPro.data.data.isMe, true);
    assert.equal(sendPro.data.data.senderRole, 'PROFESSIONAL');

    // 5. Customer fetches messages and sees both in order
    const custMsgs = await api(`/api/bookings/${bookingId}/messages`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(custMsgs.status, 200);
    assert.equal(custMsgs.data.data.length, 2);
    assert.equal(custMsgs.data.data[0].isMe, true);
    assert.equal(custMsgs.data.data[1].isMe, false);
    assert.equal(custMsgs.data.data[1].text, 'Yes, absolutely. I will carry high-grade copper fittings.');
  });

  await t.test('notifications unread count and mark-as-read workflow', async () => {
    // Customer should have received notification when Pro replied
    const countRes = await api('/api/notifications/unread-count', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(countRes.status, 200);
    assert.equal(typeof countRes.data.data.count, 'number');
    assert.ok(countRes.data.data.count >= 1);

    // Fetch notifications list
    const notifsRes = await api('/api/notifications', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(notifsRes.status, 200);
    const notifs = notifsRes.data.data;
    assert.ok(notifs.length > 0);
    const targetNotif = notifs[0];

    // Mark as read
    const markRes = await api(`/api/notifications/${targetNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(markRes.status, 200);
    assert.equal(markRes.data.success, true);
    assert.equal(markRes.data.data.read, true);
  });

  await t.test('generates compliant GST tax invoice and warranty certificate for booking', async () => {
    // 1. Customer fetches invoice
    const invRes = await api(`/api/bookings/${bookingId}/invoice`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(invRes.status, 200);
    assert.equal(invRes.data.success, true);
    const inv = invRes.data.data;
    assert.ok(inv.invoiceNumber.startsWith('INV-2026-'));
    assert.equal(inv.company.gstin, '29AAFCO1234M1Z5');
    assert.equal(inv.customer.name, 'Aarav Mehta');
    assert.equal(inv.professional.name, 'Ravi Kumar');
    assert.ok(inv.lineItems.length > 0);
    assert.equal(inv.lineItems[0].sacCode, '998719');
    assert.ok(inv.totalAmount > 0);
    assert.equal(inv.warrantyDays, 30);
    assert.ok(inv.warrantyExpiresAt);

    // 2. Assigned professional can also access the invoice
    const proInvRes = await api(`/api/bookings/${bookingId}/invoice`, {
      headers: { Authorization: `Bearer ${proToken}` }
    });
    assert.equal(proInvRes.status, 200);
    assert.equal(proInvRes.data.success, true);

    // 3. Unauthenticated request rejected
    const unauthRes = await api(`/api/bookings/${bookingId}/invoice`);
    assert.equal(unauthRes.status, 401);

    // 4. Non-existent booking returns 404
    const notFoundRes = await api('/api/bookings/non-existent-booking-id/invoice', {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    assert.equal(notFoundRes.status, 404);
  });
});
