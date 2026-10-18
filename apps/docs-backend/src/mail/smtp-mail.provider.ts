import { ConfigService } from '@nestjs/config';
import nodemailer, {
  Mail,
  SMTPSentMessageInfo,
  SMTPTransportOptions,
} from 'nodemailer';

import { MailProvider, OutgoingMail, SentMail } from './mail.models';

export class SmtpMailProvider implements MailProvider {
  private readonly transporter: Mail<SMTPSentMessageInfo, SMTPTransportOptions>;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: false, // TLS сразу при подключении пока не нужен
    });
  }

  async send(mail: OutgoingMail): Promise<SentMail> {
    const info = await this.transporter.sendMail({
      from: this.config.getOrThrow<string>('SMTP_FROM'),
      ...mail,
    });

    return {
      messageId: info.messageId,
    };
  }
}
