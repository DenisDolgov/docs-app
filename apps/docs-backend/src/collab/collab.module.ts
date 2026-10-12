import { Module } from '@nestjs/common';

import { CollabGateway } from './collab.gateway';
import { CollabService } from './collab.service';

@Module({
  providers: [CollabService, CollabGateway],
  exports: [CollabService],
})
export class CollabModule {}
