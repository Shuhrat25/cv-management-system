interface SFTokenResponse {
  access_token: string;
  instance_url: string;
  expires_in?: number;
}

interface SFConfig {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  flow: 'client_credentials' | 'password';
  username?: string;
  password?: string;
  version: string;
  timeoutMs: number;
  cacheMs: number;
}

export class SalesforceError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

function salesforceUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new SalesforceError('Invalid Salesforce URL configuration.', 503); }
  if (url.protocol !== 'https:' || !/(^|\.)salesforce\.com$/i.test(url.hostname) || url.username || url.password || url.port ||
      (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
    throw new SalesforceError('Salesforce URLs must use HTTPS on a Salesforce domain.', 503);
  }
  return url.origin;
}

function boundedNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new SalesforceError('Invalid Salesforce timeout or token cache configuration.', 503);
  }
  return parsed;
}

function getConfig(): SFConfig {
  if (process.env.SF_ENABLED !== 'true') throw new SalesforceError('Salesforce connection is not enabled.', 503);
  const { SF_LOGIN_URL, SF_CLIENT_ID, SF_CLIENT_SECRET } = process.env;
  if (!SF_LOGIN_URL || !SF_CLIENT_ID || !SF_CLIENT_SECRET) {
    throw new SalesforceError('Salesforce connection is not configured.', 503);
  }
  const flow = process.env.SF_AUTH_FLOW || 'client_credentials';
  if (flow !== 'client_credentials' && flow !== 'password') {
    throw new SalesforceError('Unsupported Salesforce authentication flow.', 503);
  }
  if (flow === 'password' && (!process.env.SF_USERNAME || !process.env.SF_PASSWORD)) {
    throw new SalesforceError('The selected legacy Salesforce flow is not configured.', 503);
  }
  const version = process.env.SF_API_VERSION || 'v60.0';
  if (!/^v\d{2,3}\.\d+$/.test(version)) throw new SalesforceError('Invalid Salesforce API version.', 503);
  return {
    loginUrl: salesforceUrl(SF_LOGIN_URL), clientId: SF_CLIENT_ID, clientSecret: SF_CLIENT_SECRET, flow,
    username: flow === 'password' ? process.env.SF_USERNAME : undefined,
    password: flow === 'password' ? process.env.SF_PASSWORD : undefined,
    version,
    timeoutMs: boundedNumber(process.env.SF_TIMEOUT_MS, 10_000, 100, 30_000),
    cacheMs: boundedNumber(process.env.SF_TOKEN_CACHE_MS, 300_000, 100, 900_000),
  };
}

let cachedToken: { key: string; value: SFTokenResponse; expiresAt: number } | undefined;
let pendingToken: { key: string; promise: Promise<SFTokenResponse> } | undefined;

async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
  } catch {
    throw new SalesforceError('Salesforce could not be reached. Check the connection configuration and try again.');
  }
}

async function parseResponse(response: Response): Promise<any> {
  try { return await response.json(); } catch { throw new SalesforceError('Salesforce returned an invalid response.'); }
}

export async function getSalesforceToken(): Promise<SFTokenResponse> {
  const config = getConfig();
  const key = JSON.stringify(config);
  if (cachedToken?.key === key && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (pendingToken?.key === key) return pendingToken.promise;
  const promise = (async () => {
    const params = new URLSearchParams({ grant_type: config.flow, client_id: config.clientId, client_secret: config.clientSecret });
    if (config.flow === 'password') {
      params.set('username', config.username!);
      params.set('password', config.password!);
    }
    const response = await timedFetch(`${config.loginUrl}/services/oauth2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params,
    }, config.timeoutMs);
    if (!response.ok) throw new SalesforceError('Salesforce authentication failed. Check the application policies and credentials.');
    const data = await parseResponse(response) as SFTokenResponse;
    if (typeof data.access_token !== 'string' || !data.access_token || typeof data.instance_url !== 'string') {
      throw new SalesforceError('Salesforce returned an invalid authentication response.');
    }
    data.instance_url = salesforceUrl(data.instance_url);
    const expiresMs = Number(data.expires_in) * 1000;
    const ttl = Number.isFinite(expiresMs) && expiresMs > 0 ? Math.min(config.cacheMs, expiresMs * 0.9) : config.cacheMs;
    cachedToken = { key, value: data, expiresAt: Date.now() + ttl };
    return data;
  })();
  pendingToken = { key, promise };
  try { return await promise; } finally { if (pendingToken?.promise === promise) pendingToken = undefined; }
}

async function requestSalesforce(path: string, init: RequestInit = {}): Promise<any> {
  const config = getConfig();
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getSalesforceToken();
    const response = await timedFetch(`${token.instance_url}/services/data/${config.version}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    }, config.timeoutMs);
    if (response.status === 401 && attempt === 0) {
      cachedToken = undefined;
      continue;
    }
    if (!response.ok) throw new SalesforceError('Salesforce API request failed. Check the integration user permissions.');
    return parseResponse(response);
  }
  throw new SalesforceError('Salesforce authentication expired. Try verifying the connection again.');
}

export async function verifySalesforceConnection(): Promise<{ success: true; instance_url: string; writesEnabled: boolean }> {
  // Limits is read-only and confirms that the token can use the REST API.
  await requestSalesforce('/limits');
  const token = await getSalesforceToken();
  return { success: true, instance_url: token.instance_url, writesEnabled: process.env.SF_WRITES_ENABLED === 'true' };
}

export async function createSalesforceAccountContact(
  account: Record<string, string>, contact: Record<string, string>
): Promise<{ accountId: string; contactId: string }> {
  if (process.env.SF_WRITES_ENABLED !== 'true') throw new SalesforceError('Salesforce record creation is disabled.', 403);
  const config = getConfig();
  const base = `/services/data/${config.version}/sobjects`;
  // Roll back the Account too if Contact creation fails.
  const data = await requestSalesforce('/composite', {
    method: 'POST',
    body: JSON.stringify({ allOrNone: true, compositeRequest: [
      { method: 'POST', url: `${base}/Account`, referenceId: 'account', body: account },
      { method: 'POST', url: `${base}/Contact`, referenceId: 'contact', body: { ...contact, AccountId: '@{account.id}' } },
    ] }),
  });
  const results = data?.compositeResponse;
  const accountResult = Array.isArray(results) ? results.find((item: any) => item.referenceId === 'account') : undefined;
  const contactResult = Array.isArray(results) ? results.find((item: any) => item.referenceId === 'contact') : undefined;
  if (accountResult?.httpStatusCode !== 201 || contactResult?.httpStatusCode !== 201 ||
      typeof accountResult?.body?.id !== 'string' || typeof contactResult?.body?.id !== 'string') {
    throw new SalesforceError('Salesforce could not create the linked records. No partial records were committed.');
  }
  return { accountId: accountResult.body.id, contactId: contactResult.body.id };
}
