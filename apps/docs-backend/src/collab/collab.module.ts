import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionModule } from '../permission/permission.module';
import { CollabGateway } from './collab.gateway';
import { CollabRepository } from './collab.repository';
import { CollabService } from './collab.service';
import { CollabAccessService } from './collab-access.service';

@Module({
  imports: [DatabaseModule, PermissionModule, AuthModule],
  providers: [
    CollabService,
    CollabGateway,
    CollabRepository,
    CollabAccessService,
  ],
  exports: [CollabService],
})
export class CollabModule {}
