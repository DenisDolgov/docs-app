import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { OrganizationModule } from '../organization/organization.module';
import { PermissionModule } from '../permission/permission.module';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';
import { FolderController } from './folder.controller';
import { FolderRepository } from './folder.repository';
import { FolderService } from './folder.service';
import { OrganizationDocumentController } from './organization-document.controller';
import { OrganizationFolderController } from './organization-folder.controller';
import { PublicDocumentController } from './public-document.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    OrganizationModule,
    PermissionModule,
    AuditModule,
  ],
  providers: [
    DocumentRepository,
    DocumentService,
    FolderRepository,
    FolderService,
  ],
  controllers: [
    DocumentController,
    OrganizationDocumentController,
    PublicDocumentController,
    OrganizationFolderController,
    FolderController,
  ],
  exports: [DocumentRepository],
})
export class DocumentModule {}
