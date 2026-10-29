import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';
import {
  OrganizationInviteAcceptController,
  OrganizationInviteController,
} from './organization-invite.controller';
import { OrganizationInviteRepository } from './organization-invite.repository';
import { OrganizationInviteService } from './organization-invite.service';
import { OrganizationMemberRepository } from './organization-member.repository';

@Module({
  imports: [DatabaseModule, AuthModule, MailModule],
  providers: [
    OrganizationRepository,
    OrganizationMemberRepository,
    OrganizationInviteRepository,
    OrganizationService,
    OrganizationInviteService,
  ],
  controllers: [
    OrganizationController,
    OrganizationInviteController,
    OrganizationInviteAcceptController,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}
