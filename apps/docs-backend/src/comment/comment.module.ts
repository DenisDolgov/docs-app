import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PermissionModule } from '../permission/permission.module';
import {
  CommentController,
  DocumentCommentController,
} from './comment.controller';
import { CommentRepository } from './comment.repository';
import { CommentService } from './comment.service';

@Module({
  imports: [DatabaseModule, AuthModule, PermissionModule],
  providers: [CommentRepository, CommentService],
  controllers: [DocumentCommentController, CommentController],
})
export class CommentModule {}
