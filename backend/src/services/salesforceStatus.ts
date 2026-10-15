import { hasPrivateJwtSecret } from '../middleware/auth';
import { verifySalesforceConnection } from './salesforce';

export interface PublicSalesforceStatus {
  connected: boolean;
  checkedAt: string | null;
  cached: boolean;
  nextCheckAt: string | null;
  readOnly: true;
}

interface ProbeDependencies {
  verify: () => Promise<unknown>;
  isReady: () => boolean;
  now: () => number;
}

const STATUS_TTL_MS = 60_000;

function isReady(): boolean {
  return process.env.SF_ENABLED === 'true' && hasPrivateJwtSecret() &&
    ['SF_LOGIN_URL', 'SF_CLIENT_ID', 'SF_CLIENT_SECRET'].every((key) => !!process.env[key]?.trim());
}

/** Only a fixed read-only probe is public; credentials and CRM responses never leave this service. */
export function createSalesforceStatusProbe(overrides: Partial<ProbeDependencies> = {}) {
  const dependencies: ProbeDependencies = {
    verify: verifySalesforceConnection,
    isReady,
    now: Date.now,
    ...overrides,
  };
  type Snapshot = Omit<PublicSalesforceStatus, 'cached'>;
  let cached: { value: Snapshot; expiresAt: number } | undefined;
  let pending: Promise<Snapshot> | undefined;

  return async function getStatus(): Promise<PublicSalesforceStatus> {
    if (!dependencies.isReady()) {
      cached = undefined;
      return { connected: false, checkedAt: null, cached: false, nextCheckAt: null, readOnly: true };
    }
    if (cached && cached.expiresAt > dependencies.now()) {
      return { ...cached.value, cached: true };
    }
    if (!pending) {
      pending = (async () => {
        let connected = false;
        try {
          await dependencies.verify();
          connected = true;
        } catch {
          // Cache failures too, so public callers cannot repeatedly trigger failing OAuth requests.
        }
        const completedAt = dependencies.now();
        const expiresAt = completedAt + STATUS_TTL_MS;
        const value: Snapshot = {
          connected,
          checkedAt: new Date(completedAt).toISOString(),
          nextCheckAt: new Date(expiresAt).toISOString(),
          readOnly: true,
        };
        cached = { value, expiresAt };
        return value;
      })();
    }
    const current = pending;
    try {
      return { ...await current, cached: false };
    } finally {
      if (pending === current) pending = undefined;
    }
  };
}

export const getPublicSalesforceStatus = createSalesforceStatusProbe();
