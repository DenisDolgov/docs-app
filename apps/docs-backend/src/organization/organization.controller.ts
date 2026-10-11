import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AccessTokenPayload } from '../auth/auth.models';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { addMemberDto } from './dto/add-member.dto';
import { createOrganizationDto } from './dto/create-organization.dto';
import { OrganizationService } from './organization.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
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
  async getAll(@CurrentUser() user: AccessTokenPayload) {
    return this.organizationService.listForUser(user.sub);
  }

  @Post('/:organizationId/members')
  async addMember(
    @CurrentUser() user: AccessTokenPayload,
    @Param('organizationId') organizationId: string,
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

  @Get('/:organizationId/members')
  getMembers(
    @CurrentUser() user: AccessTokenPayload,
    @Param('organizationId') organizationId: string,
  ) {
    return this.organizationService.listMembers({
      organizationId,
      actorId: user.sub,
    });
  }
}
