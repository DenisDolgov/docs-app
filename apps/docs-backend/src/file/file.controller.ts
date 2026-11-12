import {
  downloadUrlResponse,
  fileDto,
  fileIdSchema,
  type ListFilesQueryDto,
  listFilesQuery,
  type UploadUrlRequestDto,
  uploadUrlRequest,
  uploadUrlResponse,
} from '@docs-app/contracts/file';
import { fileRoute } from '@docs-app/contracts/file/routes';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Redirect,
  SerializeOptions,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTemporaryRedirectResponse,
} from '@nestjs/swagger';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileService } from './file.service';

// Право на файл считается в сервисе: `PermissionGuard` берёт `documentId` из
// path, а у `/files/:fileId` такого параметра нет.
@Controller(fileRoute.base)
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post(fileRoute.uploadUrlSegment)
  @SerializeOptions({ schema: uploadUrlResponse })
  @ApiCreatedResponse({ standardSchema: uploadUrlResponse })
  requestUpload(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: uploadUrlRequest }) body: UploadUrlRequestDto,
  ) {
    return this.fileService.requestUpload({
      actorId: user.sub,
      ...body,
    });
  }

  @Post(fileRoute.completePattern)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: fileDto })
  @ApiOkResponse({ standardSchema: fileDto })
  complete(
    @CurrentUser() user: AccessTokenPayload,
    @Param(fileRoute.param, { schema: fileIdSchema }) fileId: string,
  ) {
    return this.fileService.complete({ fileId, actorId: user.sub });
  }

  @Get(fileRoute.downloadUrlPattern)
  @SerializeOptions({ schema: downloadUrlResponse })
  @ApiOkResponse({ standardSchema: downloadUrlResponse })
  downloadUrl(
    @CurrentUser() user: AccessTokenPayload,
    @Param(fileRoute.param, { schema: fileIdSchema }) fileId: string,
  ) {
    return this.fileService.getDownloadUrl({ fileId, actorId: user.sub });
  }

  @Get(fileRoute.contentPattern)
  @Redirect()
  @ApiTemporaryRedirectResponse({
    description: 'Редирект на подписанную ссылку хранилища',
  })
  async content(
    @CurrentUser() user: AccessTokenPayload,
    @Param(fileRoute.param, { schema: fileIdSchema }) fileId: string,
  ) {
    const url = await this.fileService.getContentUrl({
      fileId,
      actorId: user.sub,
    });

    return { url };
  }

  @Get()
  @SerializeOptions({ schema: fileDto })
  @ApiOkResponse({ standardSchema: fileDto, isArray: true })
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query({ schema: listFilesQuery }) { documentId }: ListFilesQueryDto,
  ) {
    return this.fileService.list({ documentId, actorId: user.sub });
  }

  @Delete(fileRoute.byIdPattern)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param(fileRoute.param, { schema: fileIdSchema }) fileId: string,
  ) {
    return this.fileService.remove({ fileId, actorId: user.sub });
  }
}
