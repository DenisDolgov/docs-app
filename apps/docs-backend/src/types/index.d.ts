import { AuthenticatedRequest } from '../auth/types';

declare global {
  namespace Express {
    interface Request extends AuthenticatedRequest {}
  }
}
