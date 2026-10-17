// Маршруты документа. `base`/`param` используются в бэкенд-декораторах,
// `paths` — полные пути для клиента.
const base = 'documents';
const param = 'documentId';

export const documentRoute = {
  base,
  param,
  byIdPattern: `/:${param}`,
  paths: {
    collection: `/${base}`,
    byId: (documentId: string) => `/${base}/${documentId}`,
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
