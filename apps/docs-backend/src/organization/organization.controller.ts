import {
  addMemberDto,
  createdOrganizationResponseDto,
  createOrganizationDto,
  organizationMemberResponseDto,
  organizationResponseDto,
} from '@docs-app/contracts/organization';
import { organizationRoute } from '@docs-app/contracts/organization/routes';
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
import { OrganizationService } from './organization.service';

@Controller(organizationRoute.base)
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @SerializeOptions({ schema: createdOrganizationResponseDto })
  @ApiCreatedResponse({ standardSchema: createdOrganizationResponseDto })
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: createOrganizationDto })
    { name }: z.infer<typeof createOrganizationDto>,
  ) {
    return this.organizationService.create({
      userId: user.sub,
      name,
    });
  }

  @Get()
  @SerializeOptions({ schema: organizationResponseDto })
  @ApiOkResponse({ standardSchema: organizationResponseDto, isArray: true })
  async getAll(@CurrentUser() user: AccessTokenPayload) {
    return this.organizationService.listForUser(user.sub);
  }

  @Post(organizationRoute.membersPattern)
  @SerializeOptions({ schema: organizationMemberResponseDto })
  @ApiCreatedResponse({ standardSchema: organizationMemberResponseDto })
  async addMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationRoute.param) organizationId: string,
    @Body({ schema: addMemberDto }) {
      email,
      role,
    }: z.infer<typeof addMemberDto>,
  ) {
    return this.organizationService.addMember({
      organizationId,
      actorId: user.sub,
      email,
      role,
    });
  }

  @Get(organizationRoute.membersPattern)
  @SerializeOptions({ schema: organizationMemberResponseDto })
  @ApiOkResponse({
    standardSchema: organizationMemberResponseDto,
    isArray: true,
  })
  getMembers(
    @CurrentUser() user: AccessTokenPayload,
    @Param(organizationRoute.param) organizationId: string,
  ) {
    return this.organizationService.listMembers({
      organizationId,
      actorId: user.sub,
    });
  }
}
