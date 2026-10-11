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
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller('organizations/:organizationId/documents')
@UseGuards(JwtAuthGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  async create(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Body() { title }: CreateDocumentDto,
  ) {
    return this.documentService.create({
      title,
      organizationId,
      actorId: req.user.sub,
    });
  }

  @Get()
  async getAll(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
  ) {
    return this.documentService.list({
      organizationId,
      actorId: req.user.sub,
    });
  }

  @Get('/:documentId')
  async get(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.get({
      documentId,
      organizationId,
      actorId: req.user.sub,
    });
  }

  @Patch('/:documentId')
  @HttpCode(HttpStatus.OK)
  async update(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
    @Body() { title }: UpdateDocumentDto,
  ) {
    return this.documentService.update({
      documentId,
      organizationId,
      actorId: req.user.sub,
      title,
    });
  }

  @Delete('/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.remove({
      documentId,
      organizationId,
      actorId: req.user.sub,
    });
  }
}
