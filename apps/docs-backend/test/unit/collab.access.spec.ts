import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollabAccessService } from '../../src/collab/collab-access.service';
import { DocumentRepository } from '../../src/document/document.repository';
import { OrganizationMemberRepository } from '../../src/organization/organization-member.repository';

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

const document = { id: DOCUMENT_ID, organizationId: ORGANIZATION_ID };

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

  it('возвращает организацию и роль участника', async () => {
    documentRepository.findById.mockResolvedValue(document);
    organizationMemberRepository.findByOrgAndUser.mockResolvedValue({
      id: 'membership-1',
      organizationId: ORGANIZATION_ID,
      role: 'member',
    });

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toEqual({ organizationId: ORGANIZATION_ID, role: 'member' });

    expect(organizationMemberRepository.findByOrgAndUser).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      USER_ID,
    );
  });

  it('возвращает null, если документа нет', async () => {
    documentRepository.findById.mockResolvedValue(null);

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBeNull();

    expect(
      organizationMemberRepository.findByOrgAndUser,
    ).not.toHaveBeenCalled();
  });

  it('возвращает null, если пользователь не участник организации', async () => {
    documentRepository.findById.mockResolvedValue(document);
    organizationMemberRepository.findByOrgAndUser.mockResolvedValue(null);

    await expect(
      service.resolveAccess({ documentId: DOCUMENT_ID, userId: OUTSIDER_ID }),
    ).resolves.toBeNull();
  });

  it('не отличает чужой документ от несуществующего', async () => {
    documentRepository.findById.mockResolvedValue(null);

    const missing = await service.resolveAccess({
      documentId: 'missing',
      userId: USER_ID,
    });

    documentRepository.findById.mockResolvedValue(document);
    organizationMemberRepository.findByOrgAndUser.mockResolvedValue(null);
    const foreign = await service.resolveAccess({
      documentId: DOCUMENT_ID,
      userId: OUTSIDER_ID,
    });

    expect(missing).toBeNull();
    expect(foreign).toBeNull();
  });
});
