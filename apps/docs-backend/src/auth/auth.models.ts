import type { RefreshTokenRevokeReason } from '../database/schema';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface AuthenticatedRequest {
  user: AccessTokenPayload;
}

export interface RegisterParams {
  email: string;
  password: string;
}

export interface SessionMetadata {
  userAgent: string | null;
  ip: string | null;
}

export interface LoginParams extends Partial<SessionMetadata> {
  email: string;
  password: string;
}

export interface SendEmailVerificationParams {
  id: string;
  email: string;
}

export interface ResetPasswordParams {
  password: string;
  token: string;
}

export interface ProfileView {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface RefreshTokenRecord {
  userId: string;
  sessionId: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: RefreshTokenRevokeReason | null;
}

export interface SessionView {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
