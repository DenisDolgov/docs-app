import {
  createDocumentDto,
  documentIdSchema,
  documentResponseDto,
  updateDocumentDto,
} from '@docs-app/contracts/document';
import { documentRoute } from '@docs-app/contracts/document/routes';
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
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { z } from 'zod';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequirePermission } from '../permission/require-permission.decorator';
import { DocumentService } from './document.service';

// Единый контур документа: список доступных, создание личного и операции над
// одним документом. Право проверяет guard через `AccessPolicyService`; сервис
// повторяет проверку для вызовов в обход HTTP.
@Controller(documentRoute.base)
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @SerializeOptions({ schema: documentResponseDto })
  @ApiCreatedResponse({ standardSchema: documentResponseDto })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: createDocumentDto })
    { title }: z.infer<typeof createDocumentDto>,
  ) {
    return this.documentService.createPersonal({
      title,
      actorId: user.sub,
    });
  }

  @Get()
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto, isArray: true })
  async getAll(@CurrentUser() user: AccessTokenPayload) {
    return this.documentService.listAccessible({ actorId: user.sub });
  }

  @Get(documentRoute.byIdPattern)
  @RequirePermission('viewer')
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto })
  async get(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
  ) {
    return this.documentService.get({ documentId, actorId: user.sub });
  }

  @Patch(documentRoute.byIdPattern)
  @RequirePermission('editor')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto })
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
    @Body({ schema: updateDocumentDto })
    { title }: z.infer<typeof updateDocumentDto>,
  ) {
    return this.documentService.update({
      documentId,
      actorId: user.sub,
      title,
    });
  }

  @Delete(documentRoute.byIdPattern)
  @RequirePermission('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
  ) {
    return this.documentService.remove({ documentId, actorId: user.sub });
  }
}
