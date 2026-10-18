import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LogMailProvider } from './log-mail.provider';
import { MAIL_PROVIDER } from './mail.constants';
import { MailService } from './mail.service';
import { SmtpMailProvider } from './smtp-mail.provider';

@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('MAIL_TRANSPORT') === 'log'
          ? new LogMailProvider()
          : new SmtpMailProvider(config),
    },
    MailService,
  ],
  exports: [MAIL_PROVIDER, MailService],
})
export class MailModule {}
