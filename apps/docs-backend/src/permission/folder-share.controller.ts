import {
  folderIdSchema,
  folderShareResponseDto,
  folderShareUserIdSchema,
  grantFolderShareDto,
} from '@docs-app/contracts/folder';
import { folderRoute } from '@docs-app/contracts/folder/routes';
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
import { FolderShareService } from './folder-share.service';

// Управление доступом к папке: только owner папки (автор или owner
// организации). Guard здесь не нужен: уровень проверяет сервис через политику.
@Controller(folderRoute.base)
@UseGuards(JwtAuthGuard)
export class FolderShareController {
  constructor(private readonly folderShareService: FolderShareService) {}

  @Get(folderRoute.sharesPattern)
  @SerializeOptions({ schema: folderShareResponseDto })
  @ApiOkResponse({ standardSchema: folderShareResponseDto, isArray: true })
  async listShares(
    @CurrentUser() user: AccessTokenPayload,
    @Param(folderRoute.param, { schema: folderIdSchema }) folderId: string,
  ) {
    return this.folderShareService.list({ folderId, actorId: user.sub });
  }

  @Post(folderRoute.sharesPattern)
  @SerializeOptions({ schema: folderShareResponseDto })
  @ApiCreatedResponse({ standardSchema: folderShareResponseDto })
  async grantShare(
    @CurrentUser() user: AccessTokenPayload,
    @Param(folderRoute.param, { schema: folderIdSchema }) folderId: string,
    @Body({ schema: grantFolderShareDto })
    { email, role }: z.infer<typeof grantFolderShareDto>,
  ) {
    return this.folderShareService.grantByEmail({
      folderId,
      email,
      role,
      actorId: user.sub,
    });
  }

  @Delete(folderRoute.sharePattern)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revokeShare(
    @CurrentUser() user: AccessTokenPayload,
    @Param(folderRoute.param, { schema: folderIdSchema }) folderId: string,
    @Param(folderRoute.shareUserParam, { schema: folderShareUserIdSchema })
    userId: string,
  ) {
    await this.folderShareService.revoke({
      folderId,
      userId,
      actorId: user.sub,
    });
  }
}
