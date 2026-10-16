import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { z } from 'zod';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentService } from './document.service';
import { createDocumentDto } from './dto/create-document.dto';
import { documentResponseDto } from './dto/document-response.dto';

// Арендный список организации: только чтение и создание внутри организации.
@Controller('organizations/:organizationId/documents')
@UseGuards(JwtAuthGuard)
export class OrganizationDocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('organizationId') organizationId: string,
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
    @Param('organizationId') organizationId: string,
  ) {
    return this.documentService.listInOrganization({
      organizationId,
      actorId: user.sub,
    });
  }
}
