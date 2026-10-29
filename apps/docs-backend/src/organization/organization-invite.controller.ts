import {
  acceptedInviteResponseDto,
  acceptInviteDto,
  createInviteDto,
  inviteIdSchema,
  organizationIdSchema,
  organizationInviteResponseDto,
} from '@docs-app/contracts/organization';
import {
  inviteRoute,
  organizationRoute,
} from '@docs-app/contracts/organization/routes';
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
import { OrganizationInviteService } from './organization-invite.service';

@Controller(organizationRoute.base)
@UseGuards(JwtAuthGuard)
export class OrganizationInviteController {
  constructor(
    private readonly organizationInviteService: OrganizationInviteService,
  ) {}

  @Post(organizationRoute.invitesPattern)
  @SerializeOptions({ schema: organizationInviteResponseDto })
  @ApiCreatedResponse({ standardSchema: organizationInviteResponseDto })
  async invite(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationRoute.param, { schema: organizationIdSchema })
    organizationId: string,
    @Body({ schema: createInviteDto })
    { email, role }: z.infer<typeof createInviteDto>,
  ) {
    return this.organizationInviteService.invite({
      organizationId,
      actorId: user.sub,
      email,
      role,
    });
  }

  @Get(organizationRoute.invitesPattern)
  @SerializeOptions({ schema: organizationInviteResponseDto })
  @ApiOkResponse({
    standardSchema: organizationInviteResponseDto,
    isArray: true,
  })
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationRoute.param, { schema: organizationIdSchema })
    organizationId: string,
  ) {
    return this.organizationInviteService.list({
      organizationId,
      actorId: user.sub,
    });
  }

  @Post(organizationRoute.inviteResendPattern)
  @SerializeOptions({ schema: organizationInviteResponseDto })
  @ApiCreatedResponse({ standardSchema: organizationInviteResponseDto })
  async resend(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationRoute.param, { schema: organizationIdSchema })
    organizationId: string,
    @Param(organizationRoute.inviteParam, { schema: inviteIdSchema })
    inviteId: string,
  ) {
    return this.organizationInviteService.resend({
      organizationId,
      inviteId,
      actorId: user.sub,
    });
  }

  @Delete(organizationRoute.invitePattern)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revoke(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationRoute.param, { schema: organizationIdSchema })
    organizationId: string,
    @Param(organizationRoute.inviteParam, { schema: inviteIdSchema })
    inviteId: string,
  ) {
    await this.organizationInviteService.revoke({
      organizationId,
      inviteId,
      actorId: user.sub,
    });
  }
}

// Принятие требует сессии, но не знания организации: она внутри приглашения.
@Controller(inviteRoute.base)
@UseGuards(JwtAuthGuard)
export class OrganizationInviteAcceptController {
  constructor(private readonly inviteService: OrganizationInviteService) {}

  @Post(inviteRoute.acceptSegment)
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: acceptedInviteResponseDto })
  @ApiOkResponse({ standardSchema: acceptedInviteResponseDto })
  async accept(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: acceptInviteDto }) {
      token,
    }: z.infer<typeof acceptInviteDto>,
  ) {
    return this.inviteService.accept({ token, userId: user.sub });
  }
}
