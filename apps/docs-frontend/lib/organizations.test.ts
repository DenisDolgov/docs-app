import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_URL } from './api';
import {
  addOrganizationMember,
  createOrganization,
  listOrganizationMembers,
} from './organizations';

const response = (status: number, body?: unknown): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response;

const ORGANIZATION_ID = '0190a2b0-0000-7000-8000-000000000001';

describe('organizations api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('создаёт организацию через POST /organizations', async () => {
    const fetchMock = vi.fn(async () =>
      response(201, { id: ORGANIZATION_ID, name: 'Академия' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createOrganization('Академия');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/organizations`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Академия' }),
      }),
    );
  });

  it('читает участников организации', async () => {
    const fetchMock = vi.fn(async () => response(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await listOrganizationMembers(ORGANIZATION_ID);

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/organizations/${ORGANIZATION_ID}/members`,
      expect.objectContaining({}),
    );
  });

  it('добавляет участника с ролью', async () => {
    const fetchMock = vi.fn(async () =>
      response(201, {
        userId: '0190a2b0-0000-7000-8000-000000000002',
        email: 'user@example.com',
        role: 'admin',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await addOrganizationMember({
      organizationId: ORGANIZATION_ID,
      email: 'user@example.com',
      role: 'admin',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/organizations/${ORGANIZATION_ID}/members`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com', role: 'admin' }),
      }),
    );
  });
});
