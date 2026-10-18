import { Inject, Injectable } from '@nestjs/common';

import { MAIL_PROVIDER } from './mail.constants';
import { MailProvider, OutgoingMail } from './mail.models';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
  ) {}

  send(message: OutgoingMail) {
    return this.mailProvider.send(message);
  }
}
