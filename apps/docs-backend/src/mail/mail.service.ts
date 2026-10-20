import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MAIL_PROVIDER } from './mail.constants';
import type {
  MailProvider,
  OutgoingMail,
  SendOrganizationInviteParams,
  SendTokenMailParams,
} from './mail.models';
import { organizationInviteTemplate } from './templates/organization-invite';
import { passwordResetTemplate } from './templates/password-reset';
import { verificationTemplate } from './templates/verification';

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
    private readonly config: ConfigService,
  ) {}

  send(message: OutgoingMail) {
    return this.mailProvider.send(message);
  }

  sendVerification({ to, token, ttlHours }: SendTokenMailParams) {
    return this.deliver(
      to,
      verificationTemplate({
        to,
        link: this.link('/verify-email', token),
        ttlHours,
      }),
    );
  }

  sendPasswordReset({ to, token, ttlHours }: SendTokenMailParams) {
    return this.deliver(
      to,
      passwordResetTemplate({
        to,
        link: this.link('/reset-password', token),
        ttlHours,
      }),
    );
  }

  sendOrganizationInvite({
    to,
    token,
    organizationName,
    inviterEmail,
  }: SendOrganizationInviteParams) {
    return this.deliver(
      to,
      organizationInviteTemplate({
        link: this.link('/invite', token),
        organizationName,
        inviterEmail,
      }),
    );
  }

  private deliver(
    to: string,
    { subject, text, html }: { subject: string; text: string; html: string },
  ) {
    return this.mailProvider.send({ to, subject, text, html });
  }

  // Адрес фронтенда берётся из конфига, а не из заголовка `Host`: тот приходит
  // от клиента и позволяет увести токен на чужой домен. Нормализация слэшей —
  // здесь, единственном месте, где собирается ссылка.
  private link(path: string, token: string) {
    const base = this.config.getOrThrow<string>('APP_URL').replace(/\/+$/, '');

    return `${base}${path}?token=${encodeURIComponent(token)}`;
  }
}
