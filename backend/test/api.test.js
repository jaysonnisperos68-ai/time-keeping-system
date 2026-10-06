const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createDb, seedAdmin } = require('../src/db');
const { createApp } = require('../src/app');

function setup() {
  const db = createDb();
  seedAdmin(db, 'admin@x.com', 'password123');
  return request(createApp(db, { jwtSecret: 'test-secret-test-secret' }));
}
const login = async (api, email, password) => (await api.post('/api/auth/login').send({ email, password })).body.token;
const bearer = (t) => ({ Authorization: 'Bearer ' + t });

test('auth required and bad login rejected', async () => {
  const api = setup();
  assert.equal((await api.get('/api/time/status')).status, 401);
  assert.equal((await api.post('/api/auth/login').send({ email: 'admin@x.com', password: 'nope' })).status, 401);
});

test('employee clock in/out flow and role protection', async () => {
  const api = setup();
  const admin = await login(api, 'admin@x.com', 'password123');
  const c = await api.post('/api/employees').set(bearer(admin)).send({ name: 'Juan', email: 'juan@x.com', password: 'secret123' });
  assert.equal(c.status, 201);
  assert.equal((await api.post('/api/employees').set(bearer(admin)).send({ name: 'J', email: 'juan@x.com', password: 'secret123' })).status, 409);

  const t = await login(api, 'juan@x.com', 'secret123');
  assert.equal((await api.post('/api/time/clock-out').set(bearer(t))).status, 409);
  assert.equal((await api.post('/api/time/clock-in').set(bearer(t))).status, 201);
  assert.equal((await api.post('/api/time/clock-in').set(bearer(t))).status, 409);
  assert.equal((await api.get('/api/time/status').set(bearer(t))).body.clockedIn, true);
  assert.equal((await api.post('/api/time/clock-out').set(bearer(t))).status, 200);
  const logs = await api.get('/api/time/logs').set(bearer(t));
  assert.equal(logs.body.logs.length, 1);

  assert.equal((await api.get('/api/employees').set(bearer(t))).status, 403);
  const rep = await api.get('/api/reports/summary').set(bearer(admin));
  assert.equal(rep.status, 200);
  assert.equal(rep.body.employees[0].daysPresent, 1);
  assert.equal((await api.get('/api/admin/logs?from=bad').set(bearer(admin))).status, 400);
});

test('deactivated user cannot log in; admin cannot deactivate self', async () => {
  const api = setup();
  const admin = await login(api, 'admin@x.com', 'password123');
  const c = await api.post('/api/employees').set(bearer(admin)).send({ name: 'A', email: 'a@x.com', password: 'secret123' });
  await api.put(`/api/employees/${c.body.id}`).set(bearer(admin)).send({ active: false });
  assert.equal((await api.post('/api/auth/login').send({ email: 'a@x.com', password: 'secret123' })).status, 401);
  assert.equal((await api.put('/api/employees/1').set(bearer(admin)).send({ active: false })).status, 400);
});
