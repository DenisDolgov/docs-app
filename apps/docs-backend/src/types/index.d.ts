import type { AuthenticatedRequest } from '../auth/auth.models';

declare global {
  namespace Express {
    interface Request extends AuthenticatedRequest {}
  }
}
