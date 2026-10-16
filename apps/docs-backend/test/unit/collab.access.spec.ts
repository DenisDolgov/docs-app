import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollabAccessService } from '../../src/collab/collab-access.service';
import { DocumentRepository } from '../../src/document/document.repository';
import { OrganizationMemberRepository } from '../../src/organization/organization-member.repository';

const OWNER_ID = 'user-owner';
const USER_ID = 'user-member';
const OUTSIDER_ID = 'user-outsider';
const ORGANIZATION_ID = 'org-1';
const DOCUMENT_ID = 'doc-1';

const documentRepository = {
  findById: vi.fn(),
};

const organizationMemberRepository = {
  findByOrgAndUser: vi.fn(),
};

const document = {
  id: DOCUMENT_ID,
  organizationId: ORGANIZATION_ID,
  createdBy: OWNER_ID,
};
const personalDocument = {
  id: DOCUMENT_ID,
  organizationId: null,
  createdBy: OWNER_ID,
};

describe('CollabAccessService (unit)', () => {
  let service: CollabAccessService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CollabAccessService,
        { provide: DocumentRepository, useValue: documentRepository },
        {
          provide: OrganizationMemberRepository,
          useValue: organizationMemberRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(CollabAccessService);
  });

  it('пускает владельца личного документа без проверки членства', async () => {
    documentRepository.findById.mockResolvedValue(personalDocument);

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: OWNER_ID }),
    ).resolves.toBe(true);

    expect(
      organizationMemberRepository.findByOrgAndUser,
    ).not.toHaveBeenCalled();
  });

  it('пускает члена организации документа', async () => {
    documentRepository.findById.mockResolvedValue(document);
    organizationMemberRepository.findByOrgAndUser.mockResolvedValue({
      id: 'membership-1',
      organizationId: ORGANIZATION_ID,
      role: 'member',
    });

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBe(true);

    expect(organizationMemberRepository.findByOrgAndUser).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      USER_ID,
    );
  });

  it('возвращает false, если документа нет', async () => {
    documentRepository.findById.mockResolvedValue(null);

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBe(false);

    expect(
      organizationMemberRepository.findByOrgAndUser,
    ).not.toHaveBeenCalled();
  });

  it('возвращает false, если пользователь не участник организации', async () => {
    documentRepository.findById.mockResolvedValue(document);
    organizationMemberRepository.findByOrgAndUser.mockResolvedValue(null);

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: OUTSIDER_ID }),
    ).resolves.toBe(false);
  });

  it('возвращает false для чужого личного документа', async () => {
    documentRepository.findById.mockResolvedValue(personalDocument);

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: OUTSIDER_ID }),
    ).resolves.toBe(false);
  });
});
