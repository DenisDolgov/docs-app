import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';

import { MailProvider, OutgoingMail, SentMail } from './mail.models';

export class LogMailProvider implements MailProvider {
  private readonly logger = new Logger(LogMailProvider.name);

  async send(email: OutgoingMail): Promise<SentMail> {
    const messageId = randomUUID();
    this.logger.log({
      messageId,
      ...email,
    });

    return { messageId };
  }
}
