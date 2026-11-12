import type { EffectiveAccessLevel } from '../permission/permission.models';
import type { FileAccessFacts } from './file.models';

export const resolveFileAccess = (
  facts: FileAccessFacts,
  userId: string,
): EffectiveAccessLevel | null => {
  if (!facts.documentId) return facts.ownerId === userId ? 'owner' : null;

  return facts.documentAccess ?? null;
};
