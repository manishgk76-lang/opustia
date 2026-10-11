import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after } from 'node:test';
import app from '../src/app';

const servers: http.Server[] = [];

async function getBaseUrl() {
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind');
  return `http://127.0.0.1:${address.port}`;
}

after(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve, reject) =>
          s.close((err) => (err ? reject(err) : resolve()))
        )
    )
  );
});

test('Rate Cards, Rescheduling, Coupon Engine, and Safety SOS Suite', async (t) => {
  const base = await getBaseUrl();

  // 1. Authenticate customer
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@opustia.demo', password: 'demo123' }),
  });
  assert.equal(loginRes.status, 200);
  const loginJson = (await loginRes.json()) as any;
  const token = loginJson.data.accessToken;
  assert.ok(token);

  await t.test('retrieves standard benchmark rate cards across all categories', async () => {
    const res = await fetch(`${base}/api/rate-cards`);
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 7);

    // Filter by plumbing category
    const plumbRes = await fetch(`${base}/api/rate-cards?category=plumbing`);
    assert.equal(plumbRes.status, 200);
    const plumbJson = (await plumbRes.json()) as any;
    assert.equal(plumbJson.data.category, 'plumbing');
    assert.ok(plumbJson.data.items.length >= 5);
    assert.equal(plumbJson.data.items[0].name, 'Tap & Mixer Repair / Replacement');
    assert.equal(plumbJson.data.items[0].price, 149);
  });

  await t.test('validates promo coupon codes and applies discounts', async () => {
    // Valid FIRST50 coupon on ₹499
    const validRes = await fetch(`${base}/api/coupons/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: 'FIRST50', amount: 499 }),
    });
    assert.equal(validRes.status, 200);
    const validJson = (await validRes.json()) as any;
    assert.equal(validJson.success, true);
    assert.equal(validJson.data.discount, 50);
    assert.equal(validJson.data.payableAmount, 449);

    // Percentage discount coupon FESTIVE20 (20% on ₹500 = ₹100)
    const festiveRes = await fetch(`${base}/api/coupons/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: 'FESTIVE20', amount: 500 }),
    });
    assert.equal(festiveRes.status, 200);
    const festiveJson = (await festiveRes.json()) as any;
    assert.equal(festiveJson.data.discount, 100);
    assert.equal(festiveJson.data.payableAmount, 400);

    // Invalid coupon code
    const invalidRes = await fetch(`${base}/api/coupons/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: 'INVALID_CODE', amount: 499 }),
    });
    assert.equal(invalidRes.status, 404);

    // Below minimum order value
    const belowMinRes = await fetch(`${base}/api/coupons/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code: 'OPUSTIA100', amount: 250 }),
    });
    assert.equal(belowMinRes.status, 400);
  });

  await t.test('allows customer to reschedule a booking slot and broadcasts safety SOS', async () => {
    // 1. Get a professional
    const prosRes = await fetch(`${base}/api/professionals`);
    const prosJson = (await prosRes.json()) as any;
    const proId = prosJson.data.items[0].id;

    // 2. Create a booking
    const bookRes = await fetch(`${base}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        professionalId: proId,
        service: 'Ceiling Fan Installation',
        date: '2026-10-25',
        time: '10:00',
        address: '100ft Road, Indiranagar, Bengaluru, 560038',
        latitude: 12.9719,
        longitude: 77.6412,
        problem: 'Fan regulator replacement',
        idempotencyKey: `test_resched_${Date.now()}`,
      }),
    });
    assert.equal(bookRes.status, 201);
    const bookJson = (await bookRes.json()) as any;
    const bookingId = bookJson.data.id;
    assert.equal(bookJson.data.date, '2026-10-25');
    assert.equal(bookJson.data.time, '10:00');

    // 3. Reschedule slot to 2026-10-28 14:00
    const reschedRes = await fetch(`${base}/api/bookings/${bookingId}/reschedule`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: '2026-10-28',
        time: '14:00',
        reason: 'Office schedule changed',
      }),
    });
    assert.equal(reschedRes.status, 200);
    const reschedJson = (await reschedRes.json()) as any;
    assert.equal(reschedJson.success, true);
    assert.equal(reschedJson.data.date, '2026-10-28');
    assert.equal(reschedJson.data.time, '14:00');

    // 4. Verify booking timeline records the reschedule event
    const timeRes = await fetch(`${base}/api/bookings/${bookingId}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(timeRes.status, 200);
    const timeJson = (await timeRes.json()) as any;
    const reschedEvent = timeJson.data.find((e: any) => e.type === 'BOOKING_RESCHEDULED');
    assert.ok(reschedEvent);
    assert.equal(reschedEvent.metadata.newDate, '2026-10-28');

    // 5. Trigger Safety SOS
    const sosRes = await fetch(`${base}/api/bookings/${bookingId}/sos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        notes: 'Test emergency safety assist trigger',
      }),
    });
    assert.equal(sosRes.status, 200);
    const sosJson = (await sosRes.json()) as any;
    assert.equal(sosJson.success, true);
    assert.ok(sosJson.data.sosReference.startsWith('SOS-'));
    assert.ok(sosJson.data.emergencyContacts.length >= 3);
    assert.equal(sosJson.data.emergencyContacts[0].number, '112');
  });
});
