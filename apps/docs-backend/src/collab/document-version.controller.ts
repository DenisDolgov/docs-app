import {
  type CreateDocumentVersionDto,
  createDocumentVersionDto,
  documentIdSchema,
  documentVersionIdSchema,
  documentVersionResponseDto,
} from '@docs-app/contracts/document';
import { documentRoute } from '@docs-app/contracts/document/routes';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { DocumentVersionService } from './document-version.service';

// История документа. Права: `viewer` читает список, `editor` создаёт версию и
// восстанавливает; чужой документ отвечает 404 через `PermissionGuard`.
@Controller(documentRoute.base)
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentVersionController {
  constructor(
    private readonly documentVersionService: DocumentVersionService,
  ) {}

  @Get(documentRoute.versionsPattern)
  @RequirePermission('viewer')
  @SerializeOptions({ schema: documentVersionResponseDto })
  @ApiOkResponse({
    standardSchema: documentVersionResponseDto,
    isArray: true,
  })
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
  ) {
    return this.documentVersionService.list({ documentId, actorId: user.sub });
  }

  @Post(documentRoute.versionsPattern)
  @RequirePermission('editor')
  @SerializeOptions({ schema: documentVersionResponseDto })
  @ApiCreatedResponse({ standardSchema: documentVersionResponseDto })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
    @Body({ schema: createDocumentVersionDto })
    { name }: CreateDocumentVersionDto,
  ) {
    return this.documentVersionService.createNamed({
      documentId,
      actorId: user.sub,
      name,
    });
  }

  @Post(documentRoute.versionRestorePattern)
  @RequirePermission('editor')
  @SerializeOptions({ schema: documentVersionResponseDto })
  @ApiCreatedResponse({ standardSchema: documentVersionResponseDto })
  async restore(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
    @Param(documentRoute.versionParam, { schema: documentVersionIdSchema })
    versionId: string,
  ) {
    return this.documentVersionService.restore({
      documentId,
      versionId,
      actorId: user.sub,
    });
  }
}
