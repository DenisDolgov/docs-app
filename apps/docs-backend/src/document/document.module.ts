import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

@Module({
  imports: [DatabaseModule, AuthModule, OrganizationModule],
  providers: [DocumentRepository, DocumentService],
  controllers: [DocumentController],
})
export class DocumentModule {}
