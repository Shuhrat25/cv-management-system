import type { AuthRequest } from '../middleware/auth';
import { hasPrivateJwtSecret } from '../middleware/auth';

// A position token grants access to its aggregate export. Public/demo views must
// not disclose it. Administrative access also needs a stable operator ID because
// this application's demo supports changing database roles.
export function serializePosition<T extends { apiToken: string; createdById: string }>(
  position: T,
  viewer?: AuthRequest['user']
) {
  const operatorIds = (process.env.INTEGRATION_OPERATOR_IDS || '')
    .split(',').map((id) => id.trim()).filter(Boolean);
  const canReadToken = hasPrivateJwtSecret() && viewer && !viewer.isDemo && (
    viewer.id === position.createdById ||
    (viewer.role === 'ADMIN' && operatorIds.includes(viewer.id))
  );
  if (canReadToken) return position;
  const { apiToken: _token, ...publicPosition } = position;
  return publicPosition;
}
