import {
  createFolderDto,
  folderResponseDto,
  folderTreeResponseDto,
} from '@docs-app/contracts/folder';
import { folderRoute } from '@docs-app/contracts/folder/routes';
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
import { FolderService } from './folder.service';

// Дерево и создание папок внутри организации. Право — членство в организации,
// его проверяет сервис.
@Controller(folderRoute.organizationBase)
@UseGuards(JwtAuthGuard)
export class OrganizationFolderController {
  constructor(private readonly folderService: FolderService) {}

  @Get()
  @SerializeOptions({ schema: folderTreeResponseDto })
  @ApiOkResponse({ standardSchema: folderTreeResponseDto, isArray: true })
  async getTree(
    @CurrentUser() user: AccessTokenPayload,
    @Param(folderRoute.organizationParam, { schema: organizationIdSchema })
    organizationId: string,
  ) {
    return this.folderService.listTree({ organizationId, actorId: user.sub });
  }

  @Post()
  @SerializeOptions({ schema: folderResponseDto })
  @ApiCreatedResponse({ standardSchema: folderResponseDto })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Param(folderRoute.organizationParam, { schema: organizationIdSchema })
    organizationId: string,
    @Body({ schema: createFolderDto })
    { name, parentId }: z.infer<typeof createFolderDto>,
  ) {
    return this.folderService.create({
      organizationId,
      actorId: user.sub,
      name,
      parentId: parentId ?? null,
    });
  }
}
