export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SentMail {
  messageId: string;
}

export interface MailProvider {
  send(mail: OutgoingMail): Promise<SentMail>;
}

export interface SendVerificationParams {
  to: string;
  token: string;
  ttlHours: number;
}

export interface SendPasswordResetParams {
  to: string;
  token: string;
}

export interface SendOrganizationInviteParams {
  to: string;
  token: string;
  organizationName: string;
  inviterEmail: string;
}

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}
