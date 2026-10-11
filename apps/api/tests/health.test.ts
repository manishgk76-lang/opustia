import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after } from 'node:test';
import app from '../src/app';

const servers: http.Server[] = [];

async function request(path: string) {
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port');
  return fetch(`http://127.0.0.1:${address.port}${path}`);
}

after(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))));
});

test('reports a healthy API', async () => {
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, message: 'Opustia API is running' });
});

test('rejects protected routes without authentication', async () => {
  const response = await request('/api/bookings');
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { success: false, message: 'Authentication required' });
});

test('provides complete legal, corporate and support information', async () => {
  const response = await request('/api/support/info');
  assert.equal(response.status, 200);
  const json = (await response.json()) as any;
  assert.equal(json.success, true);
  assert.equal(json.data.company.legalName, 'Opustia Technologies India Private Limited');
  assert.equal(json.data.company.cin, 'U72900KA2024PTC184920');
  assert.equal(json.data.company.gstin, '29AAFCO1234M1Z5');
  assert.equal(json.data.company.registeredOffice.locality, 'Indiranagar');
  assert.equal(json.data.company.registeredOffice.postalCode, '560038');
  assert.equal(json.data.grievanceOfficer.name, 'Rajeshwar Rao');
  assert.ok(json.data.contacts.tollFree);
});

test('accepts customer support inquiry tickets and validates input', async () => {
  const server = http.createServer(app);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port');
  const base = `http://127.0.0.1:${address.port}`;

  // 1. Valid ticket submission
  const validRes = await fetch(`${base}/api/support/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vishwa Test',
      email: 'vishwa@example.com',
      category: 'BOOKING_HELP',
      message: 'Need help changing my plumbing appointment schedule.',
    }),
  });
  assert.equal(validRes.status, 201);
  const validJson = (await validRes.json()) as any;
  assert.equal(validJson.success, true);
  assert.ok(validJson.data.ticketId.startsWith('TICK-2026-'));
  assert.equal(validJson.data.status, 'OPEN');

  // 2. Invalid ticket submission (message too short)
  const invalidRes = await fetch(`${base}/api/support/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vishwa Test',
      email: 'invalid-email',
      message: 'hi',
    }),
  });
  assert.equal(invalidRes.status, 400);
});

