// Комментарии живут в двух контурах: внутри документа и по собственному id.
// `base`/`param` используются в бэкенд-декораторах, `paths` — полные пути для
// клиента.
const documentBase = 'documents';
const documentParam = 'documentId';
const commentsSegment = 'comments';
const base = 'comments';
const param = 'commentId';
const resolveSegment = 'resolve';

export const commentRoute = {
  documentBase,
  documentParam,
  commentsSegment,
  base,
  param,
  resolveSegment,
  documentListPattern: `/:${documentParam}/${commentsSegment}`,
  byIdPattern: `/:${param}`,
  resolvePattern: `/:${param}/${resolveSegment}`,
  paths: {
    list: (documentId: string) =>
      `/${documentBase}/${documentId}/${commentsSegment}`,
    create: (documentId: string) =>
      `/${documentBase}/${documentId}/${commentsSegment}`,
    byId: (commentId: string) => `/${base}/${commentId}`,
    resolve: (commentId: string) => `/${base}/${commentId}/${resolveSegment}`,
  },
} as const;
