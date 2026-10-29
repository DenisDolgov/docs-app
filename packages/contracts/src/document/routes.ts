// Маршруты документа. `base`/`param` используются в бэкенд-декораторах,
// `paths` — полные пути для клиента.
const base = 'documents';
const param = 'documentId';
const sharesSegment = 'shares';
const shareUserParam = 'userId';
const publicLinksSegment = 'public-links';
const publicLinkParam = 'linkId';

export const documentRoute = {
  base,
  param,
  byIdPattern: `/:${param}`,
  sharesPattern: `/:${param}/${sharesSegment}`,
  sharePattern: `/:${param}/${sharesSegment}/:${shareUserParam}`,
  shareUserParam,
  publicLinksPattern: `/:${param}/${publicLinksSegment}`,
  publicLinkPattern: `/:${param}/${publicLinksSegment}/:${publicLinkParam}`,
  publicLinkParam,
  paths: {
    collection: `/${base}`,
    byId: (documentId: string) => `/${base}/${documentId}`,
    shares: (documentId: string) => `/${base}/${documentId}/${sharesSegment}`,
    share: (documentId: string, userId: string) =>
      `/${base}/${documentId}/${sharesSegment}/${userId}`,
    publicLinks: (documentId: string) =>
      `/${base}/${documentId}/${publicLinksSegment}`,
    publicLink: (documentId: string, linkId: string) =>
      `/${base}/${documentId}/${publicLinksSegment}/${linkId}`,
  },
} as const;

// Арендный контур организации: документы внутри организации.
const organizationDocumentBase = `organizations/:organizationId/${base}`;
const organizationParam = 'organizationId';

export const organizationDocumentRoute = {
  base: organizationDocumentBase,
  organizationParam,
  paths: {
    collection: (organizationId: string) =>
      `/organizations/${organizationId}/${base}`,
  },
} as const;

// Публичное чтение по токену: без сессии и без userId в пути. Токен — и есть
// предъявитель права.
const publicBase = 'public';
const publicDocumentsSegment = 'documents';
const tokenParam = 'token';

export const publicDocumentRoute = {
  base: publicBase,
  tokenParam,
  documentPattern: `${publicDocumentsSegment}/:${tokenParam}`,
  paths: {
    document: (token: string) =>
      `/${publicBase}/${publicDocumentsSegment}/${token}`,
  },
} as const;
