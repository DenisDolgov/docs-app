import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentRepository } from '../../src/document/document.repository';
import { DocumentService } from '../../src/document/document.service';
import { OrganizationMemberRepository } from '../../src/organization/organization-member.repository';

const OWNER_ID = 'user-owner';
const ADMIN_ID = 'user-admin';
const MEMBER_ID = 'user-member';
const OUTSIDER_ID = 'user-outsider';
const ORGANIZATION_ID = 'org-1';
const DOCUMENT_ID = 'doc-1';

const documentRepository = {
  create: vi.fn(),
  listByOrganization: vi.fn(),
  findByIdInOrganization: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const organizationMembersRepository = {
  findByOrgAndUser: vi.fn(),
};

const actorWithRole = (role: string, actorId = OWNER_ID) => {
  organizationMembersRepository.findByOrgAndUser.mockImplementation(
    async (_organizationId: string, userId: string) => {
      if (userId === actorId) return { id: 'membership-actor', role };

      return null;
    },
  );
};

const documentOwnedBy = (createdBy: string) => ({
  id: DOCUMENT_ID,
  organizationId: ORGANIZATION_ID,
  title: 'Заметки',
  createdBy,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
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

  describe('create', () => {
    it('создаёт документ от имени участника организации', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.create.mockResolvedValue(documentOwnedBy(MEMBER_ID));

      const document = await service.create({
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
        service.create({
          organizationId: ORGANIZATION_ID,
          actorId: OUTSIDER_ID,
          title: 'Заметки',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('возвращает документы организации для участника', async () => {
      actorWithRole('member', MEMBER_ID);
      const documents = [documentOwnedBy(OWNER_ID)];
      documentRepository.listByOrganization.mockResolvedValue(documents);

      await expect(
        service.list({ organizationId: ORGANIZATION_ID, actorId: MEMBER_ID }),
      ).resolves.toEqual(documents);
      expect(documentRepository.listByOrganization).toHaveBeenCalledWith(
        ORGANIZATION_ID,
      );
    });

    it('не показывает документы чужой организации', async () => {
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.list({ organizationId: ORGANIZATION_ID, actorId: OUTSIDER_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.listByOrganization).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('возвращает документ участнику организации', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(
        documentOwnedBy(OWNER_ID),
      );

      const document = await service.get({
        organizationId: ORGANIZATION_ID,
        actorId: MEMBER_ID,
        documentId: DOCUMENT_ID,
      });

      expect(document.id).toBe(DOCUMENT_ID);
    });

    it('ищет документ в скоупе организации', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(null);

      await expect(
        service.get({
          organizationId: ORGANIZATION_ID,
          actorId: MEMBER_ID,
          documentId: DOCUMENT_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.findByIdInOrganization).toHaveBeenCalledWith(
        DOCUMENT_ID,
        ORGANIZATION_ID,
      );
    });
  });

  describe('update', () => {
    const command = {
      organizationId: ORGANIZATION_ID,
      actorId: MEMBER_ID,
      documentId: DOCUMENT_ID,
      title: 'Новое имя',
    };

    it('создатель обновляет свой документ', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(
        documentOwnedBy(MEMBER_ID),
      );
      documentRepository.update.mockResolvedValue({
        ...documentOwnedBy(MEMBER_ID),
        title: 'Новое имя',
      });

      const document = await service.update(command);

      expect(documentRepository.update).toHaveBeenCalledWith(
        DOCUMENT_ID,
        'Новое имя',
      );
      expect(document.title).toBe('Новое имя');
    });

    it('администратор обновляет чужой документ', async () => {
      actorWithRole('admin', ADMIN_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(
        documentOwnedBy(MEMBER_ID),
      );
      documentRepository.update.mockResolvedValue({
        ...documentOwnedBy(MEMBER_ID),
        title: 'Новое имя',
      });

      await expect(
        service.update({ ...command, actorId: ADMIN_ID }),
      ).resolves.toMatchObject({ title: 'Новое имя' });
    });

    it('запрещает обычному участнику менять чужой документ', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(
        documentOwnedBy(OWNER_ID),
      );

      await expect(service.update(command)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(documentRepository.update).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено» на отсутствующий документ', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(null);

      await expect(service.update(command)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(documentRepository.update).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено» чужаку', async () => {
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.update({ ...command, actorId: OUTSIDER_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.findByIdInOrganization).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const command = {
      organizationId: ORGANIZATION_ID,
      actorId: MEMBER_ID,
      documentId: DOCUMENT_ID,
    };

    it('создатель удаляет свой документ', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(
        documentOwnedBy(MEMBER_ID),
      );

      await service.remove(command);

      expect(documentRepository.remove).toHaveBeenCalledWith(DOCUMENT_ID);
    });

    it('запрещает обычному участнику удалять чужой документ', async () => {
      actorWithRole('member', MEMBER_ID);
      documentRepository.findByIdInOrganization.mockResolvedValue(
        documentOwnedBy(OWNER_ID),
      );

      await expect(service.remove(command)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(documentRepository.remove).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено» чужаку', async () => {
      organizationMembersRepository.findByOrgAndUser.mockResolvedValue(null);

      await expect(
        service.remove({ ...command, actorId: OUTSIDER_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.remove).not.toHaveBeenCalled();
    });
  });
});
