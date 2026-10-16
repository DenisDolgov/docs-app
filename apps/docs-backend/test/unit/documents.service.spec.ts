import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentRepository } from '../../src/document/document.repository';
import { DocumentService } from '../../src/document/document.service';
import { OrganizationMemberRepository } from '../../src/organization/organization-member.repository';

const OWNER_ID = 'user-owner';
const MEMBER_ID = 'user-member';
const OUTSIDER_ID = 'user-outsider';
const ORGANIZATION_ID = 'org-1';
const DOCUMENT_ID = 'doc-1';

const documentRepository = {
  create: vi.fn(),
  listByOrganization: vi.fn(),
  listAccessible: vi.fn(),
  findByIdInOrganization: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const organizationMembersRepository = {
  findByOrgAndUser: vi.fn(),
};

const actorWithRole = (role: string, actorId = OWNER_ID) => {
  organizationMembersRepository.findByOrgAndUser.mockImplementation(
    async (organizationId: string, userId: string) => {
      if (organizationId === ORGANIZATION_ID && userId === actorId) {
        return { id: 'membership-actor', role };
      }
      return null;
    },
  );
};

const documentOwnedBy = (createdBy: string) => ({
  id: DOCUMENT_ID,
  organizationId: ORGANIZATION_ID as string | null,
  title: 'Заметки',
  createdBy,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: DocumentRepository, useValue: documentRepository },
        {
          provide: OrganizationMemberRepository,
          useValue: organizationMembersRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(DocumentService);
  });

  describe('createInOrganization', () => {
    it('создаёт документ от имени участника организации', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.create.mockResolvedValue(documentOwnedBy(MEMBER_ID));

      const document = await service.createInOrganization({
        organizationId: ORGANIZATION_ID,
        actorId: MEMBER_ID,
        title: 'Заметки',
      });

      expect(documentRepository.create).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        createdBy: MEMBER_ID,
        title: 'Заметки',
      });
      expect(document.createdBy).toBe(MEMBER_ID);
    });

    it('отвечает «не найдено», если создатель не состоит в организации', async () => {
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.createInOrganization({
          organizationId: ORGANIZATION_ID,
          actorId: OUTSIDER_ID,
          title: 'Заметки',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('createPersonal', () => {
    it('создаёт личный документ без организации', async () => {
      documentRepository.create.mockResolvedValue({
        ...documentOwnedBy(MEMBER_ID),
        organizationId: null,
      });

      const document = await service.createPersonal({
        actorId: MEMBER_ID,
        title: 'Личное',
      });

      expect(documentRepository.create).toHaveBeenCalledWith({
        createdBy: MEMBER_ID,
        title: 'Личное',
      });
      expect(document.organizationId).toBeNull();
    });
  });

  describe('listInOrganization', () => {
    it('возвращает документы организации для участника', async () => {
      actorWithRole('member', MEMBER_ID);
      const documents = [documentOwnedBy(OWNER_ID)];
      documentRepository.listByOrganization.mockResolvedValue(documents);

      await expect(
        service.listInOrganization({
          organizationId: ORGANIZATION_ID,
          actorId: MEMBER_ID,
        }),
      ).resolves.toEqual(documents);
      expect(documentRepository.listByOrganization).toHaveBeenCalledWith(
        ORGANIZATION_ID,
      );
    });

    it('не показывает документы чужой организации', async () => {
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.listInOrganization({
          organizationId: ORGANIZATION_ID,
          actorId: OUTSIDER_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.listByOrganization).not.toHaveBeenCalled();
    });
  });

  describe('listAccessible', () => {
    it('возвращает все доступные документы пользователя', async () => {
      const documents = [documentOwnedBy(OWNER_ID)];
      documentRepository.listAccessible.mockResolvedValue(documents);

      await expect(
        service.listAccessible({ actorId: MEMBER_ID }),
      ).resolves.toEqual(documents);
      expect(documentRepository.listAccessible).toHaveBeenCalledWith(MEMBER_ID);
    });
  });

  describe('get', () => {
    it('владелец читает личный документ', async () => {
      documentRepository.findById.mockResolvedValue({
        ...documentOwnedBy(OWNER_ID),
        organizationId: null,
      });

      const document = await service.get({
        actorId: OWNER_ID,
        documentId: DOCUMENT_ID,
      });

      expect(document.id).toBe(DOCUMENT_ID);
      expect(
        organizationMembersRepository.findByOrgAndUser,
      ).not.toHaveBeenCalled();
    });

    it('участник организации читает организационный документ', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(OWNER_ID));
      actorWithRole('member', MEMBER_ID);

      const document = await service.get({
        actorId: MEMBER_ID,
        documentId: DOCUMENT_ID,
      });

      expect(document.id).toBe(DOCUMENT_ID);
    });

    it('отвечает «не найдено» чужаку', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(OWNER_ID));
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.get({ actorId: OUTSIDER_ID, documentId: DOCUMENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('отвечает «не найдено» на несуществующий документ', async () => {
      documentRepository.findById.mockResolvedValue(null);

      await expect(
        service.get({ actorId: OWNER_ID, documentId: DOCUMENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('владелец обновляет свой документ', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(MEMBER_ID));
      documentRepository.update.mockResolvedValue({
        ...documentOwnedBy(MEMBER_ID),
        title: 'Новое имя',
      });

      const document = await service.update({
        actorId: MEMBER_ID,
        documentId: DOCUMENT_ID,
        title: 'Новое имя',
      });

      expect(documentRepository.update).toHaveBeenCalledWith(
        DOCUMENT_ID,
        'Новое имя',
      );
      expect(document.title).toBe('Новое имя');
    });

    it('участник организации обновляет чужой документ', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(OWNER_ID));
      actorWithRole('member', MEMBER_ID);
      documentRepository.update.mockResolvedValue({
        ...documentOwnedBy(OWNER_ID),
        title: 'Новое имя',
      });

      await expect(
        service.update({
          actorId: MEMBER_ID,
          documentId: DOCUMENT_ID,
          title: 'Новое имя',
        }),
      ).resolves.toMatchObject({ title: 'Новое имя' });
    });

    it('отвечает «не найдено» чужаку', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(OWNER_ID));
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.update({
          actorId: OUTSIDER_ID,
          documentId: DOCUMENT_ID,
          title: 'Взлом',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('владелец удаляет свой документ', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(MEMBER_ID));

      await service.remove({ actorId: MEMBER_ID, documentId: DOCUMENT_ID });

      expect(documentRepository.remove).toHaveBeenCalledWith(DOCUMENT_ID);
    });

    it('участник организации удаляет организационный документ', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(OWNER_ID));
      actorWithRole('member', MEMBER_ID);

      await service.remove({ actorId: MEMBER_ID, documentId: DOCUMENT_ID });

      expect(documentRepository.remove).toHaveBeenCalledWith(DOCUMENT_ID);
    });

    it('отвечает «не найдено» чужаку', async () => {
      documentRepository.findById.mockResolvedValue(documentOwnedBy(OWNER_ID));
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.remove({ actorId: OUTSIDER_ID, documentId: DOCUMENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.remove).not.toHaveBeenCalled();
    });
  });
});
