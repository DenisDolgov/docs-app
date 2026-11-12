import { describe, expect, it } from 'vitest';

import type { FileAccessFacts } from '../../src/file/file.models';
import { resolveFileAccess } from '../../src/file/file-access';

const OWNER_ID = '0192f5b0-1c00-7000-8000-000000000001';
const OTHER_ID = '0192f5b0-1c00-7000-8000-000000000002';
const DOCUMENT_ID = '0192f5b0-1c00-7000-8000-000000000003';

const facts = (overrides: Partial<FileAccessFacts>): FileAccessFacts => ({
  ownerId: OWNER_ID,
  documentId: null,
  documentAccess: null,
  ...overrides,
});

describe('resolveFileAccess', () => {
  it('даёт владельцу личного файла полный уровень', () => {
    expect(resolveFileAccess(facts({}), OWNER_ID)).toBe('owner');
  });

  it('не даёт постороннему доступа к личному файлу', () => {
    expect(resolveFileAccess(facts({}), OTHER_ID)).toBeNull();
  });

  it('отдаёт уровень, унаследованный от документа', () => {
    expect(
      resolveFileAccess(
        facts({ documentId: DOCUMENT_ID, documentAccess: 'viewer' }),
        OTHER_ID,
      ),
    ).toBe('viewer');
  });

  it('не поднимает уровень владельцу файла без прав на документ', () => {
    expect(
      resolveFileAccess(
        facts({ documentId: DOCUMENT_ID, documentAccess: null }),
        OWNER_ID,
      ),
    ).toBeNull();
  });

  it('не понижает уровень участника документа до владельца файла', () => {
    expect(
      resolveFileAccess(
        facts({ documentId: DOCUMENT_ID, documentAccess: 'editor' }),
        OWNER_ID,
      ),
    ).toBe('editor');
  });
});
