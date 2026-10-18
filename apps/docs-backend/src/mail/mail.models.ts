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
