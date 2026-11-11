import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionModule } from '../permission/permission.module';
import { CollabGateway } from './collab.gateway';
import { CollabRepository } from './collab.repository';
import { CollabService } from './collab.service';
import { CollabAccessService } from './collab-access.service';
import { DocumentVersionController } from './document-version.controller';
import { DocumentVersionRepository } from './document-version.repository';
import { DocumentVersionService } from './document-version.service';
import { VersionCheckpointService } from './version-checkpoint.service';

@Module({
  imports: [DatabaseModule, PermissionModule, AuthModule, AuditModule],
  providers: [
    CollabService,
    CollabGateway,
    CollabRepository,
    CollabAccessService,
    DocumentVersionRepository,
    DocumentVersionService,
    VersionCheckpointService,
  ],
  controllers: [DocumentVersionController],
  exports: [CollabService],
})
export class CollabModule {}
