const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/prisma');
const { getJwtSecret, hasPrivateJwtSecret, optionalAuthenticate } = require('../src/middleware/auth');
const authRoutes = require('../src/routes/auth').default;
const externalRoutes = require('../src/routes/externalApi').default;

const secret = 'unit-test-only-private-key-01234567890123456789';
const users = new Map([
  ['seed-admin', { id: 'seed-admin', email: 'admin@example.com', name: 'Demo Admin', role: 'ADMIN', isBlocked: false }],
  ['operator', { id: 'operator', email: 'operator@example.test', name: 'Operator', role: 'ADMIN', isBlocked: false }],
  ['promoted', { id: 'promoted', email: 'promoted@example.test', name: 'Promoted', role: 'ADMIN', isBlocked: false }],
  ['candidate', { id: 'candidate', email: 'candidate@example.test', name: 'Candidate', role: 'CANDIDATE', isBlocked: false }],
]);
const originalFindUnique = prisma.user.findUnique;
const originalFindMany = prisma.user.findMany;
const originalFetch = global.fetch;
let server;
let port;
let networkCalls = 0;

function token(id, extra = {}) {
  return jwt.sign({ id, ...extra }, secret, { expiresIn: '1m' });
}

function request(path, { method = 'GET', body, bearer } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
    } }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, data: text ? JSON.parse(text) : {} }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

before(async () => {
  process.env.JWT_SECRET = secret;
  process.env.DEMO_SEED = 'true';
  process.env.INTEGRATION_OPERATOR_IDS = 'operator';
  process.env.SF_ENABLED = 'true';
  process.env.SF_WRITES_ENABLED = 'false';
  process.env.SF_LOGIN_URL = 'https://unit-test.my.salesforce.com';
  process.env.SF_CLIENT_ID = 'synthetic-client';
  process.env.SF_CLIENT_SECRET = 'synthetic-secret';
  process.env.SF_AUTH_FLOW = 'client_credentials';
  for (const user of users.values()) user.passwordHash = bcrypt.hashSync('synthetic-test-password', 4);
  prisma.user.findUnique = async ({ where }) => where.id ? users.get(where.id) || null : [...users.values()].find((user) => user.email === where.email) || null;
  prisma.user.findMany = async () => [...users.values()];
  global.fetch = async () => { networkCalls++; throw new Error('Unexpected external request'); };
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/external', externalRoutes);
  app.get('/optional', optionalAuthenticate, (req, res) => res.json({ user: req.user || null }));
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  port = server.address().port;
});

after(async () => {
  global.fetch = originalFetch;
  prisma.user.findUnique = originalFindUnique;
  prisma.user.findMany = originalFindMany;
  await new Promise((resolve) => server.close(resolve));
});

test('all Salesforce paths reject unauthenticated callers before an external request', async () => {
  for (const [path, method] of [['/test-auth', 'GET'], ['/create-contact', 'POST'], ['/future-endpoint', 'GET']]) {
    const result = await request(`/api/external/salesforce${path}`, { method, body: method === 'POST' ? {} : undefined });
    assert.equal(result.status, 401);
  }
  assert.equal(networkCalls, 0);
});

test('demo JWTs, legacy seeded JWTs, promoted admins and candidates cannot use Salesforce', async () => {
  for (const bearer of [token('seed-admin'), token('operator', { isDemo: true }), token('promoted'), token('candidate')]) {
    assert.equal((await request('/api/external/salesforce/test-auth', { bearer })).status, 403);
  }
  assert.equal(networkCalls, 0);
});

test('writes stay disabled even for the dedicated integration operator', async () => {
  const result = await request('/api/external/salesforce/create-contact', { method: 'POST', body: {}, bearer: token('operator') });
  assert.equal(result.status, 403);
  assert.match(result.data.error, /disabled/);
  assert.equal(networkCalls, 0);
});

test('authenticated connection verification calls only token and read-only limits endpoints', async () => {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/services/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'synthetic-token', instance_url: 'https://unit-test.my.salesforce.com' }));
    }
    assert.ok(url.endsWith('/limits'));
    return new Response(JSON.stringify({ DailyApiRequests: { Max: 100, Remaining: 100 } }));
  };
  try {
    const result = await request('/api/external/salesforce/test-auth', { bearer: token('operator') });
    assert.equal(result.status, 200);
    assert.equal(result.data.success, true);
    assert.equal(result.data.writesEnabled, false);
    assert.deepEqual(calls.map((call) => call.method), ['POST', 'GET']);
  } finally {
    global.fetch = async () => { networkCalls++; throw new Error('Unexpected external request'); };
  }
});

test('public registration cannot create an administrator', async () => {
  const result = await request('/api/auth/register', { method: 'POST', body: {
    email: 'new@example.test', password: 'synthetic-test-password', name: 'New User', role: 'ADMIN',
  } });
  assert.equal(result.status, 403);
});

test('demo switching is opt-in and restricted to existing seeded identities', async () => {
  process.env.DEMO_SEED = 'false';
  assert.equal((await request('/api/auth/switch-demo', { method: 'POST', body: { userId: 'seed-admin' } })).status, 403);
  assert.deepEqual((await request('/api/auth/demo-users')).data, []);
  process.env.DEMO_SEED = 'true';
  assert.equal((await request('/api/auth/switch-demo', { method: 'POST', body: { userId: 'operator' } })).status, 403);
  const seeded = await request('/api/auth/switch-demo', { method: 'POST', body: { userId: 'seed-admin' } });
  assert.equal(seeded.status, 200);
  assert.equal(jwt.verify(seeded.data.token, secret).isDemo, true);
  assert.deepEqual((await request('/api/auth/demo-users')).data.map((user) => user.id), ['seed-admin']);
});

test('password login for the public seeded admin remains a demo session', async () => {
  const result = await request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'synthetic-test-password' } });
  assert.equal(result.status, 200);
  assert.equal(jwt.verify(result.data.token, secret).isDemo, true);
});

test('optional authentication treats invalid tokens as anonymous and identifies old demo sessions', async () => {
  assert.equal((await request('/optional')).data.user, null);
  assert.equal((await request('/optional', { bearer: 'invalid' })).data.user, null);
  assert.equal((await request('/optional', { bearer: token('seed-admin') })).data.user.isDemo, true);
  assert.equal((await request('/optional', { bearer: token('operator') })).data.user.isDemo, false);
});

test('enabled external integrations require a strong private JWT secret', () => {
  delete process.env.JWT_SECRET;
  assert.equal(hasPrivateJwtSecret(), false);
  assert.throws(getJwtSecret, /private JWT_SECRET/);
  process.env.JWT_SECRET = 'short';
  assert.equal(hasPrivateJwtSecret(), false);
  assert.throws(getJwtSecret, /private JWT_SECRET/);
  process.env.JWT_SECRET = 'super-secret-course-project-key-2026';
  assert.equal(hasPrivateJwtSecret(), false);
  assert.throws(getJwtSecret, /private JWT_SECRET/);
  process.env.JWT_SECRET = secret;
  assert.equal(hasPrivateJwtSecret(), true);
  assert.equal(getJwtSecret(), secret);
});
