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

export interface SendTokenMailParams {
  to: string;
  token: string;
  ttlHours: number;
}

export interface SendOrganizationInviteParams {
  to: string;
  token: string;
  organizationName: string;
  inviterEmail: string;
  // Срок задаёт домен приглашений: шаблон только озвучивает его.
  ttlDays: number;
}

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}
