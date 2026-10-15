const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { getSalesforceToken, verifySalesforceConnection, createSalesforceAccountContact } = require('../src/services/salesforce');

const originalFetch = global.fetch;
let sequence = 0;

function configure(extra = {}) {
  Object.assign(process.env, {
    SF_ENABLED: 'true', SF_WRITES_ENABLED: 'false', SF_AUTH_FLOW: 'client_credentials',
    SF_LOGIN_URL: 'https://test-client.my.salesforce.com', SF_CLIENT_ID: `synthetic-${sequence++}`,
    SF_CLIENT_SECRET: 'synthetic-secret', SF_TOKEN_CACHE_MS: '300000', SF_TIMEOUT_MS: '1000', SF_API_VERSION: 'v60.0',
    ...extra,
  });
}

function json(data, status = 200) { return new Response(JSON.stringify(data), { status }); }
function oauthToken(value = 'synthetic-token') {
  return json({ access_token: value, instance_url: 'https://test-client.my.salesforce.com' });
}

after(() => { global.fetch = originalFetch; });

test('client credentials flow is default and concurrent calls share a bounded cache', async () => {
  configure();
  delete process.env.SF_AUTH_FLOW;
  let calls = 0;
  global.fetch = async (url, init) => {
    calls++;
    assert.ok(url.endsWith('/services/oauth2/token'));
    assert.equal(init.body.get('grant_type'), 'client_credentials');
    assert.equal(init.body.get('client_id'), process.env.SF_CLIENT_ID);
    assert.equal(init.body.has('username'), false);
    assert.ok(init.signal);
    return oauthToken();
  };
  const [first, second] = await Promise.all([getSalesforceToken(), getSalesforceToken()]);
  assert.equal(first.access_token, second.access_token);
  await getSalesforceToken();
  assert.equal(calls, 1);
});

test('expired cached tokens are refreshed', async () => {
  configure({ SF_TOKEN_CACHE_MS: '100' });
  let calls = 0;
  global.fetch = async () => { calls++; return oauthToken(); };
  await getSalesforceToken();
  await new Promise((resolve) => setTimeout(resolve, 125));
  await getSalesforceToken();
  assert.equal(calls, 2);
});

test('legacy password flow requires an explicit selection', async () => {
  configure({ SF_AUTH_FLOW: 'password', SF_USERNAME: 'synthetic-user', SF_PASSWORD: 'synthetic-password-token' });
  global.fetch = async (_url, init) => {
    assert.equal(init.body.get('grant_type'), 'password');
    assert.equal(init.body.get('username'), 'synthetic-user');
    assert.equal(init.body.get('password'), 'synthetic-password-token');
    return oauthToken();
  };
  await getSalesforceToken();
});

test('disabled, incomplete and unsafe configuration never makes a network request', async () => {
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Unexpected external request'); };
  configure({ SF_ENABLED: 'false' });
  await assert.rejects(getSalesforceToken, /not enabled/);
  configure();
  delete process.env.SF_CLIENT_SECRET;
  await assert.rejects(getSalesforceToken, /not configured/);
  configure({ SF_LOGIN_URL: 'http://localhost:1234' });
  await assert.rejects(getSalesforceToken, /HTTPS/);
  configure({ SF_LOGIN_URL: 'https://salesforce.com.attacker.example' });
  await assert.rejects(getSalesforceToken, /Salesforce domain/);
  assert.equal(calls, 0);
});

test('authentication errors do not forward upstream response contents', async () => {
  configure();
  global.fetch = async () => json({ error: 'invalid_client', error_description: 'private upstream detail' }, 401);
  await assert.rejects(getSalesforceToken, (error) => {
    assert.match(error.message, /authentication failed/);
    assert.doesNotMatch(error.message, /private upstream detail|synthetic-secret/);
    return true;
  });
});

test('network timeouts are bounded and produce a safe error', async () => {
  configure({ SF_TIMEOUT_MS: '100' });
  global.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Mock request exceeded timeout')), 500);
    init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(init.signal.reason); }, { once: true });
  });
  const started = Date.now();
  await assert.rejects(getSalesforceToken, /could not be reached/);
  assert.ok(Date.now() - started < 450);
});

test('read-only verification refreshes an expired session once without creating records', async () => {
  configure();
  const calls = [];
  let apiCalls = 0;
  global.fetch = async (url, init) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/services/oauth2/token')) return oauthToken();
    assert.ok(url.endsWith('/limits'));
    apiCalls++;
    return apiCalls === 1 ? json([{ errorCode: 'INVALID_SESSION_ID' }], 401) : json({ DailyApiRequests: {} });
  };
  const result = await verifySalesforceConnection();
  assert.equal(result.writesEnabled, false);
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'GET', 'POST', 'GET']);
});

test('record creation is opt-in and Account/Contact are sent as one atomic composite', async () => {
  configure();
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Unexpected external request'); };
  await assert.rejects(() => createSalesforceAccountContact({ Name: 'Synthetic' }, { LastName: 'Test' }), /disabled/);
  assert.equal(calls, 0);
  process.env.SF_WRITES_ENABLED = 'true';
  global.fetch = async (url, init) => {
    if (url.endsWith('/services/oauth2/token')) return oauthToken();
    assert.ok(url.endsWith('/composite'));
    const body = JSON.parse(init.body);
    assert.equal(body.allOrNone, true);
    assert.equal(body.compositeRequest[1].body.AccountId, '@{account.id}');
    return json({ compositeResponse: [
      { referenceId: 'account', httpStatusCode: 201, body: { id: 'synthetic-account' } },
      { referenceId: 'contact', httpStatusCode: 201, body: { id: 'synthetic-contact' } },
    ] });
  };
  assert.deepEqual(await createSalesforceAccountContact({ Name: 'Synthetic' }, { LastName: 'Test' }), {
    accountId: 'synthetic-account', contactId: 'synthetic-contact',
  });
});
