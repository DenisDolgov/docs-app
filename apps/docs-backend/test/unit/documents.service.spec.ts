import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentRepository } from '../../src/document/document.repository';
import { DocumentService } from '../../src/document/document.service';
import { OrganizationService } from '../../src/organization/organization.service';
import { AccessPolicyService } from '../../src/permission/access-policy.service';

const MEMBER_ID = 'user-member';
const OUTSIDER_ID = 'user-outsider';
const ORGANIZATION_ID = '0192f5b0-1c00-7000-8000-000000000001';
const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000002';

const documentRepository = {
  create: vi.fn(),
  listByOrganization: vi.fn(),
  listAccessible: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
};

const organizationService = {
  requireMember: vi.fn(),
};

const accessPolicy = {
  assertDocumentAccess: vi.fn(),
  invalidateDocument: vi.fn(),
};

const documentOwnedBy = (createdBy: string) => ({
  id: DOCUMENT_ID,
  organizationId: ORGANIZATION_ID as string | null,
  title: 'Заметки',
  createdBy,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const requirePermission = (required: string) => {
  accessPolicy.assertDocumentAccess.mockImplementation(
    async (params: { required: string }) => {
      if (params.required !== required) throw new NotFoundException();
      return 'editor';
    },
  );
};

describe('DocumentService', () => {
  let service: DocumentService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: DocumentRepository, useValue: documentRepository },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    service = moduleRef.get(DocumentService);
  });

  describe('createInOrganization', () => {
    it('создаёт документ от имени участника организации', async () => {
      organizationService.requireMember.mockResolvedValue({
        role: 'member',
      });
      documentRepository.create.mockResolvedValue(documentOwnedBy(MEMBER_ID));

      const document = await service.createInOrganization({
        organizationId: ORGANIZATION_ID,
        actorId: MEMBER_ID,
        title: 'Заметки',
      });

      expect(organizationService.requireMember).toHaveBeenCalledWith(
        ORGANIZATION_ID,
        MEMBER_ID,
      );
      expect(documentRepository.create).toHaveBeenCalledWith({
        organizationId: ORGANIZATION_ID,
        createdBy: MEMBER_ID,
        title: 'Заметки',
      });
      expect(document.createdBy).toBe(MEMBER_ID);
    });

    it('отвечает «не найдено», если создатель не состоит в организации', async () => {
      organizationService.requireMember.mockRejectedValue(
        new NotFoundException(),
      );

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
    it('отдаёт документы организации участнику', async () => {
      organizationService.requireMember.mockResolvedValue({ role: 'member' });
      documentRepository.listByOrganization.mockResolvedValue([
        documentOwnedBy(MEMBER_ID),
      ]);

      const documents = await service.listInOrganization({
        organizationId: ORGANIZATION_ID,
        actorId: MEMBER_ID,
      });

      expect(documents).toHaveLength(1);
      expect(documentRepository.listByOrganization).toHaveBeenCalledWith(
        ORGANIZATION_ID,
      );
    });

    it('отвечает «не найдено» чужаку', async () => {
      organizationService.requireMember.mockRejectedValue(
        new NotFoundException(),
      );

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
    it('делегирует в репозиторий, который учитывает share', async () => {
      documentRepository.listAccessible.mockResolvedValue([
        documentOwnedBy(MEMBER_ID),
      ]);

      await service.listAccessible({ actorId: MEMBER_ID });

      expect(documentRepository.listAccessible).toHaveBeenCalledWith(MEMBER_ID);
    });
  });

  describe('get', () => {
    it('отдаёт документ после проверки права', async () => {
      requirePermission('viewer');
      documentRepository.findById.mockResolvedValue(documentOwnedBy(MEMBER_ID));

      const document = await service.get({
        actorId: MEMBER_ID,
        documentId: DOCUMENT_ID,
      });

      expect(accessPolicy.assertDocumentAccess).toHaveBeenCalledWith({
        documentId: DOCUMENT_ID,
        principal: { userId: MEMBER_ID },
        required: 'viewer',
      });
      expect(document.id).toBe(DOCUMENT_ID);
    });

    it('отвечает «не найдено», если политика доступа не пустила', async () => {
      accessPolicy.assertDocumentAccess.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.get({ actorId: OUTSIDER_ID, documentId: DOCUMENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.findById).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено», если документ исчез между проверкой и чтением', async () => {
      requirePermission('viewer');
      documentRepository.findById.mockResolvedValue(null);

      await expect(
        service.get({ actorId: MEMBER_ID, documentId: DOCUMENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('обновляет документ при праве editor', async () => {
      requirePermission('editor');
      documentRepository.update.mockResolvedValue({
        ...documentOwnedBy(MEMBER_ID),
        title: 'Новое',
      });

      const updated = await service.update({
        actorId: MEMBER_ID,
        documentId: DOCUMENT_ID,
        title: 'Новое',
      });

      expect(updated.title).toBe('Новое');
      expect(documentRepository.update).toHaveBeenCalledWith(
        DOCUMENT_ID,
        'Новое',
      );
    });

    it('отвечает «не найдено» viewer-у и не пишет в БД', async () => {
      accessPolicy.assertDocumentAccess.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.update({
          actorId: OUTSIDER_ID,
          documentId: DOCUMENT_ID,
          title: 'Новое',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.update).not.toHaveBeenCalled();
    });

    it('отвечает «не найдено», если UPDATE ничего не вернул', async () => {
      requirePermission('editor');
      documentRepository.update.mockResolvedValue(null);

      await expect(
        service.update({
          actorId: MEMBER_ID,
          documentId: DOCUMENT_ID,
          title: 'Новое',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('удаляет документ и инвалидирует кэш права', async () => {
      requirePermission('editor');
      documentRepository.remove.mockResolvedValue(true);

      await service.remove({ actorId: MEMBER_ID, documentId: DOCUMENT_ID });

      expect(documentRepository.remove).toHaveBeenCalledWith(DOCUMENT_ID);
      expect(accessPolicy.invalidateDocument).toHaveBeenCalledWith(DOCUMENT_ID);
    });

    it('отвечает «не найдено», если DELETE ничего не вернул', async () => {
      requirePermission('editor');
      documentRepository.remove.mockResolvedValue(false);

      await expect(
        service.remove({ actorId: MEMBER_ID, documentId: DOCUMENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(accessPolicy.invalidateDocument).not.toHaveBeenCalled();
    });

    it('не удаляет чужой документ', async () => {
      accessPolicy.assertDocumentAccess.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.remove({ actorId: OUTSIDER_ID, documentId: DOCUMENT_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(documentRepository.remove).not.toHaveBeenCalled();
    });
  });
});
