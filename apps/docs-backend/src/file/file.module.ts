import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DocumentModule } from '../document/document.module';
import { PermissionModule } from '../permission/permission.module';
import { StorageModule } from '../storage/storage.module';
import { FILE_BUCKET } from './file.constants';
import { FileController } from './file.controller';
import { FileRepository } from './file.repository';
import { FileService } from './file.service';
import { FileBucketService } from './file-bucket.service';
import { FileGcService } from './file-gc.service';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    DocumentModule,
    PermissionModule,
    StorageModule,
    AuditModule,
  ],
  providers: [
    {
      provide: FILE_BUCKET,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string>('S3_BUCKET'),
    },
    FileRepository,
    FileService,
    FileBucketService,
    FileGcService,
  ],
  controllers: [FileController],
})
export class FileModule {}
