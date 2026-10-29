import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollabAccessService } from '../../src/collab/collab-access.service';
import { AccessPolicyService } from '../../src/permission/access-policy.service';

const USER_ID = 'user-member';
const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000001';

const accessPolicy = {
  getDocumentAccess: vi.fn(),
};

describe('CollabAccessService (unit)', () => {
  let service: CollabAccessService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CollabAccessService,
        { provide: AccessPolicyService, useValue: accessPolicy },
      ],
    }).compile();

    service = moduleRef.get(CollabAccessService);
  });

  const level = (value: string | null) =>
    accessPolicy.getDocumentAccess.mockResolvedValue(value);

  it('спрашивает политику про конкретный документ и пользователя', async () => {
    level('editor');

    await service.canEdit({ documentId: DOCUMENT_ID, userId: USER_ID });

    expect(accessPolicy.getDocumentAccess).toHaveBeenCalledWith({
      documentId: DOCUMENT_ID,
      principal: { userId: USER_ID },
    });
  });

  it('пускает editor-а в комнату', async () => {
    level('editor');

    await expect(
      service.canEdit({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBe(true);
  });

  it('пускает владельца документа', async () => {
    level('owner');

    await expect(
      service.canEdit({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBe(true);
  });

  it('не пускает viewer-а: комната — это запись, а не чтение', async () => {
    level('viewer');

    await expect(
      service.canEdit({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBe(false);
  });

  it('не пускает commenter-а', async () => {
    level('commenter');

    await expect(
      service.canEdit({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBe(false);
  });

  it('не пускает чужака и несуществующий документ одинаково', async () => {
    level(null);

    await expect(
      service.canEdit({ documentId: DOCUMENT_ID, userId: USER_ID }),
    ).resolves.toBe(false);
  });
});
