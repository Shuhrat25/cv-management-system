const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSalesforceStatusProbe } = require('../src/services/salesforceStatus');

test('concurrent public probes share one verification and expose only an allowlist', async () => {
  let calls = 0;
  let finish;
  const probe = createSalesforceStatusProbe({
    isReady: () => true,
    now: () => Date.UTC(2026, 9, 15, 12),
    verify: () => {
      calls++;
      return new Promise((resolve) => { finish = resolve; });
    },
  });
  const results = Promise.all(Array.from({ length: 12 }, () => probe()));
  assert.equal(calls, 1);
  finish({ access_token: 'synthetic-private-token', instance_url: 'https://private-org.my.salesforce.com', limits: { Remaining: 123 } });
  for (const status of await results) {
    assert.deepEqual(status, {
      connected: true,
      checkedAt: '2026-10-15T12:00:00.000Z',
      nextCheckAt: '2026-10-15T12:01:00.000Z',
      readOnly: true,
      cached: false,
    });
  }
});

test('cache retains the actual completion timestamp and expires after exactly 60 seconds', async () => {
  let time = Date.UTC(2026, 9, 15, 12);
  let calls = 0;
  const probe = createSalesforceStatusProbe({
    isReady: () => true,
    now: () => time,
    verify: async () => { calls++; time += 250; },
  });
  const first = await probe();
  assert.equal(first.checkedAt, '2026-10-15T12:00:00.250Z');
  assert.equal(first.cached, false);
  time += 59_999;
  const reused = await probe();
  assert.equal(reused.checkedAt, first.checkedAt);
  assert.equal(reused.nextCheckAt, first.nextCheckAt);
  assert.equal(reused.cached, true);
  assert.equal(calls, 1);
  time += 1;
  const refreshed = await probe();
  assert.equal(calls, 2);
  assert.equal(refreshed.cached, false);
  assert.equal(refreshed.checkedAt, '2026-10-15T12:01:00.500Z');
});

test('failed probes are cached and neither upstream errors nor credentials are returned', async () => {
  let calls = 0;
  const probe = createSalesforceStatusProbe({
    isReady: () => true,
    now: () => Date.UTC(2026, 9, 15, 12),
    verify: async () => {
      calls++;
      throw new Error('synthetic-client-secret synthetic-access-token private Salesforce org detail');
    },
  });
  const first = await probe();
  const second = await probe();
  assert.equal(calls, 1);
  assert.equal(first.connected, false);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(second.checkedAt, first.checkedAt);
  assert.equal(second.nextCheckAt, first.nextCheckAt);
  assert.doesNotMatch(JSON.stringify([first, second]), /synthetic|secret|token|private|error|org/);
});

test('an integration that is not ready performs no network check and invalidates its visible cached success', async () => {
  let ready = true;
  let calls = 0;
  const probe = createSalesforceStatusProbe({
    isReady: () => ready,
    verify: async () => { calls++; },
    now: () => Date.UTC(2026, 9, 15, 12),
  });
  assert.equal((await probe()).connected, true);
  ready = false;
  assert.deepEqual(await probe(), {
    connected: false, checkedAt: null, cached: false, nextCheckAt: null, readOnly: true,
  });
  assert.equal(calls, 1);
  ready = true;
  assert.equal((await probe()).cached, false);
  assert.equal(calls, 2);
});

test('default readiness requires SF_ENABLED, complete credentials and a private JWT signing key', async () => {
  const keys = ['SF_ENABLED', 'SF_LOGIN_URL', 'SF_CLIENT_ID', 'SF_CLIENT_SECRET', 'JWT_SECRET'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  let calls = 0;
  const probe = createSalesforceStatusProbe({ verify: async () => { calls++; } });
  try {
    Object.assign(process.env, {
      SF_ENABLED: 'true', SF_LOGIN_URL: 'https://synthetic.my.salesforce.com',
      SF_CLIENT_ID: 'synthetic-client', SF_CLIENT_SECRET: 'synthetic-secret',
      JWT_SECRET: 'unit-test-only-private-key-01234567890123456789',
    });
    for (const [key, value] of [
      ['SF_ENABLED', 'false'], ['SF_CLIENT_SECRET', ''], ['SF_LOGIN_URL', ''],
      ['JWT_SECRET', 'short'], ['JWT_SECRET', 'super-secret-course-project-key-2026'],
    ]) {
      const original = process.env[key];
      process.env[key] = value;
      const status = await probe();
      assert.equal(status.connected, false);
      assert.equal(status.checkedAt, null);
      assert.equal(calls, 0);
      process.env[key] = original;
    }
    assert.equal((await probe()).connected, true);
    assert.equal(calls, 1);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
