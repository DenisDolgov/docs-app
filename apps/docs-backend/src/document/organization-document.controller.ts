import {
  createDocumentDto,
  documentResponseDto,
} from '@docs-app/contracts/document';
import { organizationDocumentRoute } from '@docs-app/contracts/document/routes';
import { organizationIdSchema } from '@docs-app/contracts/organization';
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
import { z } from 'zod';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentService } from './document.service';

// Арендный список организации: только чтение и создание внутри организации.
// Право на конкретный документ здесь не проверяется — членство в организации
// проверяет сервис.
@Controller(organizationDocumentRoute.base)
@UseGuards(JwtAuthGuard)
export class OrganizationDocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @SerializeOptions({ schema: documentResponseDto })
  @ApiCreatedResponse({ standardSchema: documentResponseDto })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationDocumentRoute.organizationParam, {
      schema: organizationIdSchema,
    })
    organizationId: string,
    @Body({ schema: createDocumentDto })
    { title }: z.infer<typeof createDocumentDto>,
  ) {
    return this.documentService.createInOrganization({
      title,
      organizationId,
      actorId: user.sub,
    });
  }

  @Get()
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto, isArray: true })
  async getAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationDocumentRoute.organizationParam, {
      schema: organizationIdSchema,
    })
    organizationId: string,
  ) {
    return this.documentService.listInOrganization({
      organizationId,
      actorId: user.sub,
    });
  }
}
