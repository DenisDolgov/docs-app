import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRepository } from '../../src/auth/user.repository';
import { OrganizationRepository } from '../../src/organization/organization.repository';
import { OrganizationService } from '../../src/organization/organization.service';
import { OrganizationMemberRepository } from '../../src/organization/organization-member.repository';

const OWNER_ID = 'user-owner';
const ADMIN_ID = 'user-admin';
const MEMBER_ID = 'user-member';
const TARGET_ID = 'user-target';
const TARGET_EMAIL = 'target@example.com';
const ORGANIZATION_ID = 'org-1';

const organizationsRepository = {
  create: vi.fn(),
  listForUser: vi.fn(),
};

const organizationMembersRepository = {
  create: vi.fn(),
  findByOrgAndUser: vi.fn(),
  listByOrganization: vi.fn(),
};

const usersRepository = {
  findByIds: vi.fn(),
  findByEmail: vi.fn(),
};

const actorWithRole = (role: string, actorId = OWNER_ID) => {
  organizationMembersRepository.findByOrgAndUser.mockImplementation(
    async (_organizationId: string, userId: string) => {
      if (userId === actorId) return { id: 'membership-actor', role };

      return null;
    },
  );
};

describe('OrganizationsService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: OrganizationRepository,
          useValue: organizationsRepository,
        },
        {
          provide: OrganizationMemberRepository,
          useValue: organizationMembersRepository,
        },
        { provide: UserRepository, useValue: usersRepository },
      ],
    }).compile();

    service = moduleRef.get(OrganizationService);
  });

  describe('create', () => {
    it('делает создателя владельцем организации', async () => {
      organizationsRepository.create.mockResolvedValue({
        id: ORGANIZATION_ID,
        name: 'Acme',
      });
      organizationMembersRepository.create.mockResolvedValue({
        id: 'membership-1',
        organizationId: ORGANIZATION_ID,
        userId: OWNER_ID,
        role: 'owner',
      });

      const organization = await service.create({
        userId: OWNER_ID,
        name: 'Acme',
      });

      expect(organizationsRepository.create).toHaveBeenCalledWith({
        name: 'Acme',
      });
      expect(organizationMembersRepository.create).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        userId: OWNER_ID,
        role: 'owner',
      });
      expect(organization).toEqual({ id: ORGANIZATION_ID, name: 'Acme' });
    });
  });

  describe('listForUser', () => {
    it('возвращает организации пользователя вместе с его ролью', async () => {
      const organizations = [
        { id: ORGANIZATION_ID, name: 'Acme', role: 'owner' },
      ];
      organizationsRepository.listForUser.mockResolvedValue(organizations);

      await expect(service.listForUser(OWNER_ID)).resolves.toEqual(
        organizations,
      );
      expect(organizationsRepository.listForUser).toHaveBeenCalledWith(
        OWNER_ID,
      );
    });
  });

  describe('addMember', () => {
    const command = {
      organizationId: ORGANIZATION_ID,
      actorId: OWNER_ID,
      email: TARGET_EMAIL,
      role: 'member' as const,
    };

    it('владелец добавляет участника по email', async () => {
      actorWithRole('owner');
      usersRepository.findByEmail.mockResolvedValue({
        id: TARGET_ID,
        email: TARGET_EMAIL,
      });
      organizationMembersRepository.create.mockResolvedValue({
        id: 'membership-2',
        organizationId: ORGANIZATION_ID,
        userId: TARGET_ID,
        role: 'member',
      });

      const result = await service.addMember(command);

      expect(organizationMembersRepository.create).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        userId: TARGET_ID,
        role: 'member',
      });
      expect(result).toEqual({
        userId: TARGET_ID,
        email: TARGET_EMAIL,
        role: 'member',
      });
    });

    it('администратор тоже может добавлять участников', async () => {
      actorWithRole('admin', ADMIN_ID);
      usersRepository.findByEmail.mockResolvedValue({
        id: TARGET_ID,
        email: TARGET_EMAIL,
      });
      organizationMembersRepository.create.mockResolvedValue({
        id: 'membership-2',
        organizationId: ORGANIZATION_ID,
        userId: TARGET_ID,
        role: 'admin',
      });

      const result = await service.addMember({
        ...command,
        actorId: ADMIN_ID,
        role: 'admin',
      });

      expect(result.role).toBe('admin');
    });

    it('нормализует email перед поиском пользователя', async () => {
      actorWithRole('owner');
      usersRepository.findByEmail.mockResolvedValue({
        id: TARGET_ID,
        email: TARGET_EMAIL,
      });
      organizationMembersRepository.create.mockResolvedValue({
        id: 'membership-2',
        organizationId: ORGANIZATION_ID,
        userId: TARGET_ID,
        role: 'member',
      });

      await service.addMember({ ...command, email: '  Target@Example.COM ' });

      expect(usersRepository.findByEmail).toHaveBeenCalledWith(TARGET_EMAIL);
    });

    it('запрещает обычному участнику добавлять людей', async () => {
      actorWithRole('member', MEMBER_ID);

      await expect(
        service.addMember({ ...command, actorId: MEMBER_ID }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(organizationMembersRepository.create).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено», если актор не состоит в организации', async () => {
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(service.addMember(command)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(organizationMembersRepository.create).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено», если приглашаемого пользователя нет', async () => {
      actorWithRole('owner');
      usersRepository.findByEmail.mockResolvedValue(null);

      await expect(service.addMember(command)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(organizationMembersRepository.create).not.toHaveBeenCalled();
    });

    it('отвечает конфликтом, если пользователь уже в организации', async () => {
      organizationMembersRepository.findByOrgAndUser.mockImplementation(
        async (_organizationId: string, userId: string) => {
          if (userId === OWNER_ID)
            return { id: 'membership-actor', role: 'owner' };
          if (userId === TARGET_ID) {
            return { id: 'membership-target', role: 'member' };
          }

          return null;
        },
      );
      usersRepository.findByEmail.mockResolvedValue({
        id: TARGET_ID,
        email: TARGET_EMAIL,
      });

      await expect(service.addMember(command)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(organizationMembersRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('listMembers', () => {
    const query = { organizationId: ORGANIZATION_ID, actorId: MEMBER_ID };

    it('возвращает участников с email и ролями', async () => {
      actorWithRole('member', MEMBER_ID);
      organizationMembersRepository.listByOrganization.mockResolvedValue([
        { userId: OWNER_ID, role: 'owner' },
        { userId: MEMBER_ID, role: 'member' },
      ]);
      usersRepository.findByIds.mockResolvedValue([
        { id: OWNER_ID, email: 'owner@example.com' },
        { id: MEMBER_ID, email: 'member@example.com' },
      ]);

      const members = await service.listMembers(query);

      expect(usersRepository.findByIds).toHaveBeenCalledWith([
        OWNER_ID,
        MEMBER_ID,
      ]);
      expect(members).toEqual(
        expect.arrayContaining([
          { userId: OWNER_ID, email: 'owner@example.com', role: 'owner' },
          { userId: MEMBER_ID, email: 'member@example.com', role: 'member' },
        ]),
      );
      expect(members).toHaveLength(2);
    });

    it('отвечает «не найдено», если актор не состоит в организации', async () => {
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(service.listMembers(query)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(organizationMembersRepository.listByOrganization).not.toBeCalled();
    });
  });
});
