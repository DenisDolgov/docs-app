// Маршруты папок. `organizationBase`/`byIdBase` используются в
// бэкенд-декораторах, `paths` — полные пути для клиента.
const base = 'folders';
const organizationParam = 'organizationId';
const organizationBase = `organizations/:${organizationParam}/${base}`;
const param = 'folderId';
const sharesSegment = 'shares';
const shareUserParam = 'userId';
export const folderRoute = {
  base,
  organizationParam,
  organizationBase,
  param,
  byIdPattern: `/:${param}`,
  sharesPattern: `/:${param}/${sharesSegment}`,
  sharePattern: `/:${param}/${sharesSegment}/:${shareUserParam}`,
  shareUserParam,
  paths: {
    collection: (organizationId: string) =>
      `/organizations/${organizationId}/${base}`,
    byId: (folderId: string) => `/${base}/${folderId}`,
    shares: (folderId: string) => `/${base}/${folderId}/${sharesSegment}`,
    share: (folderId: string, userId: string) =>
      `/${base}/${folderId}/${sharesSegment}/${userId}`,
  },
} as const;
