import type { OrganizationRole } from '@docs-app/contracts/organization';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { EmailVerificationPolicy } from '../auth/email-verification-policy';
import { UserRepository } from '../auth/user.repository';
import { normalizeEmail } from '../common/utils/email';
import { UnitOfWork } from '../database/unit-of-work';
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
    private readonly emailVerificationPolicy: EmailVerificationPolicy,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  public async create({ userId, name }: CreateOrganizationParams) {
    await this.emailVerificationPolicy.assertEmailVerified(userId);

    // Организация без владельца — битая строка, которую некому починить.
    // Оба insert'а должны стать видимыми вместе или не стать вовсе.
    return this.unitOfWork.run(async (tx) => {
      const { id: organizationId, name: organizationName } =
        await this.organizationRepository.create({ name }, tx);

      await this.organizationMemberRepository.create(
        {
          userId,
          organizationId,
          role: 'owner',
        },
        tx,
      );

      return {
        id: organizationId,
        name: organizationName,
      };
    });
  }

  public async findOrganization(organizationId: string) {
    return this.organizationRepository.findById(organizationId);
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
    const actorMember = await this.requireMember(organizationId, actorId);

    if (!canManageMembers(actorMember.role)) throw new ForbiddenException();

    await this.emailVerificationPolicy.assertEmailVerified(actorId);

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
    await this.requireMember(organizationId, actorId);

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

  // Роль пользователя в организации или `null`, если он не участник. Поведение
  // наружу, а не репозиторий: модуль прав не должен знать, как хранят членство.
  public async getMemberRole(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationRole | null> {
    const member = await this.organizationMemberRepository.findByOrgAndUser(
      organizationId,
      userId,
    );

    return member?.role ?? null;
  }

  // Членство как предусловие действия: чужак и несуществующая организация
  // отвечают одинаково (404).
  public async requireMember(organizationId: string, userId: string) {
    const actorMember =
      await this.organizationMemberRepository.findByOrgAndUser(
        organizationId,
        userId,
      );

    if (!actorMember) throw new NotFoundException(ORGANIZATION_NOT_FOUND_ERROR);

    return actorMember;
  }
}
