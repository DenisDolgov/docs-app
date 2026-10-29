import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionModule } from '../permission/permission.module';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';
import { OrganizationDocumentController } from './organization-document.controller';

@Module({
  imports: [DatabaseModule, AuthModule, OrganizationModule, PermissionModule],
  providers: [DocumentRepository, DocumentService],
  controllers: [DocumentController, OrganizationDocumentController],
})
export class DocumentModule {}
