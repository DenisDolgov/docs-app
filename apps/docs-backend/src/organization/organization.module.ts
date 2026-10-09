import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';
import { OrganizationMemberRepository } from './organization-member.repository';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [
    OrganizationRepository,
    OrganizationMemberRepository,
    OrganizationService,
  ],
  controllers: [OrganizationController],
})
export class OrganizationModule {}
