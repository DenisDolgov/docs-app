import { authPaths, authRoute } from '@docs-app/contracts/auth/routes';
import {
  documentRoute,
  organizationDocumentRoute,
  publicDocumentRoute,
} from '@docs-app/contracts/document/routes';
import { fileRoute } from '@docs-app/contracts/file/routes';
import { folderRoute } from '@docs-app/contracts/folder/routes';
import {
  inviteRoute,
  organizationRoute,
} from '@docs-app/contracts/organization/routes';
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
    expect(authPaths.verifyEmail).toBe(
      `/${authRoute.base}/${authRoute.verifyEmail}`,
    );
    expect(authPaths.resendEmail).toBe(
      `/${authRoute.base}/${authRoute.resendEmail}`,
    );
  });

  it('контур документов организации собран из сегментов', () => {
    expect(organizationDocumentRoute.base).toBe(
      `organizations/:${organizationDocumentRoute.organizationParam}/${documentRoute.base}`,
    );
    expect(organizationDocumentRoute.paths.collection('o1')).toBe(
      '/organizations/o1/documents',
    );
  });

  it('пути папок выведены из base и параметров', () => {
    expect(folderRoute.organizationBase).toBe(
      `organizations/:${folderRoute.organizationParam}/${folderRoute.base}`,
    );
    expect(folderRoute.byIdPattern).toBe(`/:${folderRoute.param}`);
    expect(folderRoute.paths.collection('o1')).toBe(
      '/organizations/o1/folders',
    );
    expect(folderRoute.paths.byId('f1')).toBe('/folders/f1');
    expect(folderRoute.paths.shares('f1')).toBe('/folders/f1/shares');
    expect(folderRoute.paths.share('f1', 'u1')).toBe('/folders/f1/shares/u1');
  });

  it('пути участников организации выведены из base и параметра', () => {
    expect(organizationRoute.membersPattern).toBe(
      `/:${organizationRoute.param}/members`,
    );
    expect(organizationRoute.paths.members('o1')).toBe(
      `/${organizationRoute.base}/o1/members`,
    );
  });

  it('пути приглашений и принятия согласованы', () => {
    expect(organizationRoute.invitesPattern).toBe(
      `/:${organizationRoute.param}/invites`,
    );
    expect(organizationRoute.paths.invites('o1')).toBe(
      '/organizations/o1/invites',
    );
    expect(organizationRoute.paths.invite('o1', 'i1')).toBe(
      '/organizations/o1/invites/i1',
    );
    expect(organizationRoute.paths.resendInvite('o1', 'i1')).toBe(
      '/organizations/o1/invites/i1/resend',
    );
    expect(inviteRoute.paths.accept).toBe('/invites/accept');
  });

  it('пути share и публичных ссылок выведены из сегментов', () => {
    expect(documentRoute.paths.shares('d1')).toBe('/documents/d1/shares');
    expect(documentRoute.paths.share('d1', 'u1')).toBe(
      '/documents/d1/shares/u1',
    );
    expect(documentRoute.paths.publicLinks('d1')).toBe(
      '/documents/d1/public-links',
    );
    expect(documentRoute.paths.publicLink('d1', 'l1')).toBe(
      '/documents/d1/public-links/l1',
    );
  });

  it('публичное чтение по токену живёт под /public/documents', () => {
    expect(publicDocumentRoute.documentPattern).toBe(
      `documents/:${publicDocumentRoute.tokenParam}`,
    );
    expect(publicDocumentRoute.paths.document('t0k')).toBe(
      '/public/documents/t0k',
    );
  });

  it('пути файлов выведены из base и параметра', () => {
    expect(fileRoute.byIdPattern).toBe(`/:${fileRoute.param}`);
    expect(fileRoute.paths.collection).toBe('/files');
    expect(fileRoute.paths.uploadUrl).toBe('/files/upload-url');
    expect(fileRoute.paths.complete('f1')).toBe('/files/f1/complete');
    expect(fileRoute.paths.downloadUrl('f1')).toBe('/files/f1/download-url');
    expect(fileRoute.paths.content('f1')).toBe('/files/f1/content');
  });
});
