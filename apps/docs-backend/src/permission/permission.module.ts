import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { OrganizationModule } from '../organization/organization.module';
import { RedisModule } from '../redis/redis.module';
import { AccessPolicyService } from './access-policy.service';
import { AccessResolver } from './access-resolver';
import { DocumentAccessRepository } from './document-access.repository';
import { DocumentAccessCache } from './document-access-cache';
import { DocumentShareRepository } from './document-share.repository';
import { DocumentShareService } from './document-share.service';
import { PermissionGuard } from './permission.guard';

@Module({
  imports: [DatabaseModule, RedisModule, OrganizationModule],
  providers: [
    DocumentAccessRepository,
    DocumentShareRepository,
    AccessResolver,
    DocumentAccessCache,
    AccessPolicyService,
    DocumentShareService,
    PermissionGuard,
  ],
  exports: [AccessPolicyService, DocumentShareService, PermissionGuard],
})
export class PermissionModule {}
