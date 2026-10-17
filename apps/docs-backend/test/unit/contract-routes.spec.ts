import { authPaths, authRoute } from '@docs-app/contracts/auth/routes';
import {
  documentRoute,
  organizationDocumentRoute,
} from '@docs-app/contracts/document/routes';
import { organizationRoute } from '@docs-app/contracts/organization/routes';
import { describe, expect, it } from 'vitest';

// Страж контракта путей: клиентские пути обязаны выводиться из тех же сегментов,
// что бэкенд использует в декораторах. Ловит случайную правку литерала.
describe('контракт маршрутов', () => {
  it('паттерн документа и клиентский путь согласованы', () => {
    expect(documentRoute.byIdPattern).toBe(`/:${documentRoute.param}`);
    expect(documentRoute.paths.byId('abc')).toBe(`/${documentRoute.base}/abc`);
  });

  it('полные пути auth выводятся из base', () => {
    expect(authPaths.me).toBe(`/${authRoute.base}/me`);
    expect(authPaths.refresh).toBe(`/${authRoute.base}/${authRoute.refresh}`);
  });

  it('контур документов организации собран из сегментов', () => {
    expect(organizationDocumentRoute.base).toBe(
      `organizations/:${organizationDocumentRoute.organizationParam}/${documentRoute.base}`,
    );
    expect(organizationDocumentRoute.paths.collection('o1')).toBe(
      '/organizations/o1/documents',
    );
  });

  it('пути участников организации выведены из base и параметра', () => {
    expect(organizationRoute.membersPattern).toBe(
      `/:${organizationRoute.param}/members`,
    );
    expect(organizationRoute.paths.members('o1')).toBe(
      `/${organizationRoute.base}/o1/members`,
    );
  });
});
