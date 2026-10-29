import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationModule } from '../organization/organization.module';
import { RedisModule } from '../redis/redis.module';
import { AccessPolicyService } from './access-policy.service';
import { AccessResolver } from './access-resolver';
import { DocumentAccessRepository } from './document-access.repository';
import { DocumentAccessCache } from './document-access-cache';
import { DocumentShareController } from './document-share.controller';
import { DocumentShareRepository } from './document-share.repository';
import { DocumentShareService } from './document-share.service';
import { PermissionGuard } from './permission.guard';
import { PublicLinkRepository } from './public-link.repository';
import { PublicLinkResolver } from './public-link.resolver';
import { PublicLinkService } from './public-link.service';

@Module({
  imports: [DatabaseModule, RedisModule, OrganizationModule, AuthModule],
  providers: [
    DocumentAccessRepository,
    DocumentShareRepository,
    PublicLinkRepository,
    AccessResolver,
    DocumentAccessCache,
    AccessPolicyService,
    DocumentShareService,
    PublicLinkService,
    PublicLinkResolver,
    PermissionGuard,
  ],
  controllers: [DocumentShareController],
  exports: [AccessPolicyService, DocumentShareService, PublicLinkResolver],
})
export class PermissionModule {}
