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
import { ApiOkResponse } from '@nestjs/swagger';
import { z } from 'zod';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentService } from './document.service';
import { createDocumentDto } from './dto/create-document.dto';
import { documentResponseDto } from './dto/document-response.dto';
import { updateDocumentDto } from './dto/update-document.dto';

// Единый контур документа: список доступных, создание личного и операции над
// одним документом (доступ = владелец или член организации документа).
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto })
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

  @Get('/:documentId')
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto })
  async get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.get({ documentId, actorId: user.sub });
  }

  @Patch('/:documentId')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: documentResponseDto })
  @ApiOkResponse({ standardSchema: documentResponseDto })
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('documentId') documentId: string,
    @Body({ schema: updateDocumentDto })
    { title }: z.infer<typeof updateDocumentDto>,
  ) {
    return this.documentService.update({
      documentId,
      actorId: user.sub,
      title,
    });
  }

  @Delete('/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: AccessTokenPayload,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.remove({ documentId, actorId: user.sub });
  }
}
