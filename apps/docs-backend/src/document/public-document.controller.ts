import {
  publicDocumentResponseDto,
  publicLinkTokenSchema,
} from '@docs-app/contracts/document';
import { publicDocumentRoute } from '@docs-app/contracts/document/routes';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  SerializeOptions,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

import { PublicLinkResolver } from '../permission/public-link.resolver';
import { DocumentService } from './document.service';
import { DOCUMENT_NOT_FOUND_ERROR } from './errors';

@Controller(publicDocumentRoute.base)
export class PublicDocumentController {
  constructor(
    private readonly publicLinkResolver: PublicLinkResolver,
    private readonly documentService: DocumentService,
  ) {}

  @Get(publicDocumentRoute.documentPattern)
  @SerializeOptions({ schema: publicDocumentResponseDto })
  @ApiOkResponse({ standardSchema: publicDocumentResponseDto })
  async get(
    @Param(publicDocumentRoute.tokenParam, { schema: publicLinkTokenSchema })
    token: string,
  ) {
    const resolved = await this.publicLinkResolver.resolve({ token });

    // Неизвестная, просроченная и отозванная ссылка неразличимы: 404.
    if (!resolved) throw new NotFoundException(DOCUMENT_NOT_FOUND_ERROR);

    return this.documentService.getPublic({
      documentId: resolved.documentId,
    });
  }
}
