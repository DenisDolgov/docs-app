import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { UserRepository } from '../auth/user.repository';
import { normalizeEmail } from '../common/utils/email';
import {
  ORGANIZATION_NOT_FOUND_ERROR,
  USER_ALREADY_MEMBER_ERROR,
  USER_NOT_FOUND_ERROR,
} from './errors';
import { canManageMembers } from './organization.constants';
import {
  AddMemberParams,
  CreateOrganizationParams,
  ListMembersParams,
  OrganizationMemberListItem,
} from './organization.models';
import { OrganizationRepository } from './organization.repository';
import { OrganizationMemberRepository } from './organization-member.repository';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly userRepository: UserRepository,
  ) {}

  public async create({ userId, name }: CreateOrganizationParams) {
    const { id: organizationId, name: organizationName } =
      await this.organizationRepository.create({ name });
    await this.organizationMemberRepository.create({
      userId,
      organizationId,
      role: 'owner',
    });

    return {
      id: organizationId,
      name: organizationName,
    };
  }

  public async listForUser(userId: string) {
    return this.organizationRepository.listForUser(userId);
  }

  public async addMember({
    organizationId,
    actorId,
    email,
    role,
  }: AddMemberParams) {
    const actorMember = await this.assertActorMember(organizationId, actorId);

    if (!canManageMembers(actorMember.role)) throw new ForbiddenException();

    const user = await this.userRepository.findByEmail(normalizeEmail(email));

    if (!user) throw new NotFoundException(USER_NOT_FOUND_ERROR);

    const userMember = await this.organizationMemberRepository.findByOrgAndUser(
      organizationId,
      user.id,
    );

    if (userMember) throw new ConflictException(USER_ALREADY_MEMBER_ERROR);

    const newMember = await this.organizationMemberRepository.create({
      userId: user.id,
      organizationId,
      role,
    });

    return {
      userId: newMember.userId,
      email: user.email,
      role: newMember.role,
    };
  }

  public async listMembers({ organizationId, actorId }: ListMembersParams) {
    await this.assertActorMember(organizationId, actorId);

    const members =
      await this.organizationMemberRepository.listByOrganization(
        organizationId,
      );

    const userIds = members.map((member) => member.userId);
    const users = await this.userRepository.findByIds(userIds);
    const emailById = new Map(users.map((user) => [user.id, user.email]));

    return members.reduce((acc, member) => {
      const email = emailById.get(member.userId);

      if (email) {
        acc.push({
          userId: member.userId,
          role: member.role,
          email,
        });
      } else {
        this.logger.warn(
          `Найдено членство ${member.id} с неизвестным пользователем ${member.userId}`,
        );
      }

      return acc;
    }, [] as OrganizationMemberListItem[]);
  }

  private async assertActorMember(organizationId: string, actorId: string) {
    const actorMember =
      await this.organizationMemberRepository.findByOrgAndUser(
        organizationId,
        actorId,
      );

    if (!actorMember) throw new NotFoundException(ORGANIZATION_NOT_FOUND_ERROR);

    return actorMember;
  }
}
