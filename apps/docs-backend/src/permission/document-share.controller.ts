import {
  CreatePublicLinkDto,
  createdPublicLinkResponseDto,
  createPublicLinkDto,
  documentIdSchema,
  documentShareResponseDto,
  grantDocumentShareDto,
  publicLinkIdSchema,
  publicLinkResponseDto,
  shareUserIdSchema,
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
  Post,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { z } from 'zod';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentShareService } from './document-share.service';
import { PermissionGuard } from './permission.guard';
import { PublicLinkService } from './public-link.service';
import { RequirePermission } from './require-permission.decorator';

@Controller(documentRoute.base)
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DocumentShareController {
  constructor(
    private readonly documentShareService: DocumentShareService,
    private readonly publicLinkService: PublicLinkService,
  ) {}

  @Get(documentRoute.sharesPattern)
  @RequirePermission('owner')
  @SerializeOptions({ schema: documentShareResponseDto })
  @ApiOkResponse({ standardSchema: documentShareResponseDto, isArray: true })
  async listShares(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
  ) {
    return this.documentShareService.list({ documentId, actorId: user.sub });
  }

  @Post(documentRoute.sharesPattern)
  @RequirePermission('owner')
  @SerializeOptions({ schema: documentShareResponseDto })
  @ApiCreatedResponse({ standardSchema: documentShareResponseDto })
  async grantShare(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
    @Body({ schema: grantDocumentShareDto })
    { email, role }: z.infer<typeof grantDocumentShareDto>,
  ) {
    return this.documentShareService.grantByEmail({
      documentId,
      email,
      role,
      actorId: user.sub,
    });
  }

  @Delete(documentRoute.sharePattern)
  @RequirePermission('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revokeShare(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
    @Param(documentRoute.shareUserParam, { schema: shareUserIdSchema })
    userId: string,
  ) {
    await this.documentShareService.revoke({
      documentId,
      userId,
      actorId: user.sub,
    });
  }

  @Get(documentRoute.publicLinksPattern)
  @RequirePermission('owner')
  @SerializeOptions({ schema: publicLinkResponseDto })
  @ApiOkResponse({ standardSchema: publicLinkResponseDto, isArray: true })
  async listPublicLinks(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
  ) {
    return this.publicLinkService.list({ documentId, actorId: user.sub });
  }

  @Post(documentRoute.publicLinksPattern)
  @RequirePermission('owner')
  @SerializeOptions({ schema: createdPublicLinkResponseDto })
  @ApiCreatedResponse({ standardSchema: createdPublicLinkResponseDto })
  async createPublicLink(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
    @Body({ schema: createPublicLinkDto })
    { expiresAt }: CreatePublicLinkDto,
  ) {
    return this.publicLinkService.create({
      documentId,
      actorId: user.sub,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });
  }

  @Delete(documentRoute.publicLinkPattern)
  @RequirePermission('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revokePublicLink(
    @CurrentUser() user: AccessTokenPayload,
    @Param(documentRoute.param, { schema: documentIdSchema })
    documentId: string,
    @Param(documentRoute.publicLinkParam, { schema: publicLinkIdSchema })
    linkId: string,
  ) {
    await this.publicLinkService.revoke({
      documentId,
      linkId,
      actorId: user.sub,
    });
  }
}
