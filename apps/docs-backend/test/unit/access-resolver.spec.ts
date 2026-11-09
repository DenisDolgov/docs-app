import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationService } from '../../src/organization/organization.service';
import { AccessResolver } from '../../src/permission/access-resolver';
import { DocumentAccessRepository } from '../../src/permission/document-access.repository';
import { DocumentShareRepository } from '../../src/permission/document-share.repository';
import { FolderAccessRepository } from '../../src/permission/folder-access.repository';

const OWNER_ID = '0192f5b0-1c00-7000-8000-000000000001';
const VIEWER_ID = '0192f5b0-1c00-7000-8000-000000000002';
const OUTSIDER_ID = '0192f5b0-1c00-7000-8000-000000000003';
const ORGANIZATION_ID = '0192f5b0-1c00-7000-8000-000000000010';
const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000020';
const FOLDER_ID = '0192f5b0-1c00-7000-8000-000000000030';

const documentAccessRepository = {
  findDocumentFacts: vi.fn(),
};

const organizationService = {
  getMemberRole: vi.fn(),
};

const documentShareRepository = {
  findByDocumentAndUser: vi.fn(),
};

const folderAccessRepository = {
  findShareLevelsByFolderChain: vi.fn(),
};

const organizationalDocument = {
  organizationId: ORGANIZATION_ID,
  createdBy: OWNER_ID,
  folderId: null as string | null,
};

const personalDocument = {
  organizationId: null,
  createdBy: OWNER_ID,
  folderId: null as string | null,
};

const documentInFolder = {
  organizationId: ORGANIZATION_ID,
  createdBy: OWNER_ID,
  folderId: FOLDER_ID,
};

const organizationRole = (role: string | null) => {
  organizationService.getMemberRole.mockResolvedValue(role);
};

const shareRole = (role: string | null) => {
  documentShareRepository.findByDocumentAndUser.mockResolvedValue(
    role
      ? { id: 'share-1', documentId: DOCUMENT_ID, userId: VIEWER_ID, role }
      : null,
  );
};

const folderRole = (...levels: string[]) => {
  folderAccessRepository.findShareLevelsByFolderChain.mockResolvedValue(levels);
};

// Матрица эффективного права: источники складываются по максимуму, а не по
// первому найденному. Тест — контракт куска S14.
describe('AccessResolver (unit)', () => {
  let service: AccessResolver;

  const resolve = (userId = VIEWER_ID) =>
    service.resolve({ documentId: DOCUMENT_ID, principal: { userId } });

  beforeEach(async () => {
    vi.clearAllMocks();

    organizationRole(null);
    shareRole(null);
    folderRole();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessResolver,
        {
          provide: DocumentAccessRepository,
          useValue: documentAccessRepository,
        },
        { provide: OrganizationService, useValue: organizationService },
        {
          provide: DocumentShareRepository,
          useValue: documentShareRepository,
        },
        {
          provide: FolderAccessRepository,
          useValue: folderAccessRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(AccessResolver);
  });

  describe('создатель документа', () => {
    it('получает owner на личном документе', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );

      await expect(resolve(OWNER_ID)).resolves.toBe('owner');
    });

    it('получает owner на организационном документе', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );

      await expect(resolve(OWNER_ID)).resolves.toBe('owner');
    });

    it('owner не понижается слабым share', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      shareRole('viewer');

      await expect(resolve(OWNER_ID)).resolves.toBe('owner');
    });
  });

  describe('членство в организации документа', () => {
    it('owner организации даёт owner документа', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      organizationRole('owner');

      await expect(resolve()).resolves.toBe('owner');
    });

    it('admin организации даёт editor документа', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      organizationRole('admin');

      await expect(resolve()).resolves.toBe('editor');
    });

    it('member организации даёт editor документа', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      organizationRole('member');

      await expect(resolve()).resolves.toBe('editor');
    });
  });

  describe('прямой share', () => {
    it('viewer на личном документе', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );
      shareRole('viewer');

      await expect(resolve()).resolves.toBe('viewer');
    });

    it('viewer на документе организации для чужака', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      shareRole('viewer');

      await expect(resolve()).resolves.toBe('viewer');
    });

    it('editor на документе организации для чужака', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      shareRole('editor');

      await expect(resolve()).resolves.toBe('editor');
    });

    it('commenter', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );
      shareRole('commenter');

      await expect(resolve()).resolves.toBe('commenter');
    });

    it('editor', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );
      shareRole('editor');

      await expect(resolve()).resolves.toBe('editor');
    });

    it('share не ищется для владельца: решение уже известно', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );

      await resolve(OWNER_ID);

      expect(
        documentShareRepository.findByDocumentAndUser,
      ).not.toHaveBeenCalled();
    });
  });

  describe('складывание источников', () => {
    it('member организации побеждает слабый share', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      organizationRole('member');
      shareRole('viewer');

      await expect(resolve()).resolves.toBe('editor');
    });

    it('strong-owner организации побеждает editor-share', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );
      organizationRole('owner');
      shareRole('editor');

      await expect(resolve()).resolves.toBe('owner');
    });

    it('share editor не понижается до viewer', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );
      shareRole('editor');

      await expect(resolve()).resolves.toBe('editor');
    });
  });

  describe('нет права', () => {
    it('чужой и личный документ без share — null', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );

      await expect(resolve(OUTSIDER_ID)).resolves.toBeNull();
    });

    it('чужак вне организации документа — null', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        organizationalDocument,
      );

      await expect(resolve(OUTSIDER_ID)).resolves.toBeNull();
    });

    it('нет документа — null, организацию не спрашиваем', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(null);

      await expect(resolve()).resolves.toBeNull();

      expect(organizationService.getMemberRole).not.toHaveBeenCalled();
    });

    it('личный документ не ходит в организацию за ролью', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );

      await resolve();

      expect(organizationService.getMemberRole).not.toHaveBeenCalled();
    });
  });

  describe('наследование от папки', () => {
    it('viewer на папке даёт viewer документа в ней', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        documentInFolder,
      );
      folderRole('viewer');

      await expect(resolve()).resolves.toBe('viewer');
    });

    it('право берётся по максимуму из цепочки предков', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        documentInFolder,
      );
      folderRole('viewer', 'editor');

      await expect(resolve()).resolves.toBe('editor');
    });

    it('прямой share и право папки складываются по максимуму', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        documentInFolder,
      );
      shareRole('viewer');
      folderRole('editor');

      await expect(resolve()).resolves.toBe('editor');
    });

    it('роль организации и право папки складываются по максимуму', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        documentInFolder,
      );
      organizationRole('member');
      folderRole('viewer');

      await expect(resolve()).resolves.toBe('editor');
    });

    it('папка без share не даёт права', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        documentInFolder,
      );

      await expect(resolve()).resolves.toBeNull();
    });

    it('личный документ не спрашивает цепочку папок', async () => {
      documentAccessRepository.findDocumentFacts.mockResolvedValue(
        personalDocument,
      );

      await resolve();

      expect(
        folderAccessRepository.findShareLevelsByFolderChain,
      ).not.toHaveBeenCalled();
    });
  });
});
