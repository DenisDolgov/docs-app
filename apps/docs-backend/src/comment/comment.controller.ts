import {
  type CreateCommentDto,
  commentIdSchema,
  commentListResponseDto,
  commentResponseDto,
  createCommentDto,
  type UpdateCommentDto,
  updateCommentDto,
} from '@docs-app/contracts/comment';
import { commentRoute } from '@docs-app/contracts/comment/routes';
import { documentIdSchema } from '@docs-app/contracts/document';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { CommentService } from './comment.service';

// Документ в path: `PermissionGuard` умеет проверять только этот контур.
@Controller(commentRoute.documentBase)
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentCommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get(commentRoute.documentListPattern)
  @RequirePermission('viewer')
  @SerializeOptions({ schema: commentListResponseDto })
  @ApiOkResponse({ standardSchema: commentListResponseDto })
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Param(commentRoute.documentParam, { schema: documentIdSchema })
    documentId: string,
  ) {
    return this.commentService.list({ documentId, actorId: user.sub });
  }

  @Post(commentRoute.documentListPattern)
  @RequirePermission('commenter')
  @SerializeOptions({ schema: commentResponseDto })
  @ApiCreatedResponse({ standardSchema: commentResponseDto })
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param(commentRoute.documentParam, { schema: documentIdSchema })
    documentId: string,
    @Body({ schema: createCommentDto }) body: CreateCommentDto,
  ) {
    return this.commentService.create({
      documentId,
      actorId: user.sub,
      body: body.body,
      ...(body.parentId === undefined ? {} : { parentId: body.parentId }),
      ...(body.anchor === undefined ? {} : { anchor: body.anchor }),
    });
  }
}

// У `/comments/:commentId` в path нет `documentId`, поэтому уровень проверяет
// сервис — как в `file/`.
@Controller(commentRoute.base)
@UseGuards(JwtAuthGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Patch(commentRoute.byIdPattern)
  @SerializeOptions({ schema: commentResponseDto })
  @ApiOkResponse({ standardSchema: commentResponseDto })
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param(commentRoute.param, { schema: commentIdSchema }) commentId: string,
    @Body({ schema: updateCommentDto }) body: UpdateCommentDto,
  ) {
    return this.commentService.update({
      commentId,
      actorId: user.sub,
      body: body.body,
    });
  }

  @Post(commentRoute.resolvePattern)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: commentResponseDto })
  @ApiOkResponse({ standardSchema: commentResponseDto })
  resolve(
    @CurrentUser() user: AccessTokenPayload,
    @Param(commentRoute.param, { schema: commentIdSchema }) commentId: string,
  ) {
    return this.commentService.resolve({ commentId, actorId: user.sub });
  }

  @Delete(commentRoute.byIdPattern)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param(commentRoute.param, { schema: commentIdSchema }) commentId: string,
  ) {
    return this.commentService.remove({ commentId, actorId: user.sub });
  }
}
