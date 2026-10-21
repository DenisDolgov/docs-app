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

export interface LoginParams {
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
