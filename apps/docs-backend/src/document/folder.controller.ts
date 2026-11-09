import {
  folderIdSchema,
  folderResponseDto,
  UpdateFolderDto,
  updateFolderDto,
} from '@docs-app/contracts/folder';
import { folderRoute } from '@docs-app/contracts/folder/routes';
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse } from '@nestjs/swagger';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FolderService } from './folder.service';

// Переименование, перемещение и удаление конкретной папки. Уровень проверяет
// сервис через политику папки: параметр пути здесь другой, чем у документа,
// поэтому общий `PermissionGuard` не подходит.
@Controller(folderRoute.base)
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Patch(folderRoute.byIdPattern)
  @SerializeOptions({ schema: folderResponseDto })
  @ApiOkResponse({ standardSchema: folderResponseDto })
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param(folderRoute.param, { schema: folderIdSchema }) folderId: string,
    @Body({ schema: updateFolderDto })
    { name, parentId }: UpdateFolderDto,
  ) {
    return this.folderService.update({
      folderId,
      actorId: user.sub,
      name,
      parentId,
    });
  }

  @Delete(folderRoute.byIdPattern)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param(folderRoute.param, { schema: folderIdSchema }) folderId: string,
  ) {
    await this.folderService.remove({ folderId, actorId: user.sub });
  }
}
