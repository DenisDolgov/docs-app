import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationService } from './organization.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async create(@Req() req: Request, @Body() { name }: CreateOrganizationDto) {
    return this.organizationService.create({
      userId: req.user.sub,
      name,
    });
  }

  @Get()
  async getAll(@Req() req: Request) {
    return this.organizationService.listForUser(req.user.sub);
  }

  @Post('/:organizationId/members')
  async addMember(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
    @Body() { email, role }: AddMemberDto,
  ) {
    return this.organizationService.addMember({
      organizationId,
      actorId: req.user.sub,
      email,
      role,
    });
  }

  @Get('/:organizationId/members')
  getMembers(
    @Req() req: Request,
    @Param('organizationId') organizationId: string,
  ) {
    return this.organizationService.listMembers({
      organizationId,
      actorId: req.user.sub,
    });
  }
}
