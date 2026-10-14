import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { CollabGateway } from './collab.gateway';
import { CollabRepository } from './collab.repository';
import { CollabService } from './collab.service';

@Module({
  imports: [DatabaseModule],
  providers: [CollabService, CollabGateway, CollabRepository],
  exports: [CollabService],
})
export class CollabModule {}
