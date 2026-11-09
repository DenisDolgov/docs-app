import type { OrganizationRole } from '@docs-app/contracts/organization';

import type { EffectiveAccessLevel } from './permission.models';

// Ранг права — доменное правило, а не свойство набора из контракта. Порядок в
// `documentAccessLevels` менять можно, сравнение от него не зависит.
const accessRank: Record<EffectiveAccessLevel, number> = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  owner: 4,
};

// `null` — доступа нет вообще. Сравниваем ранги: `editor` покрывает `viewer`.
export const hasAccess = (
  level: EffectiveAccessLevel | null,
  required: EffectiveAccessLevel,
): boolean => level !== null && accessRank[level] >= accessRank[required];

// Источники права складываются по максимуму: роль в организации, прямой share
// и share'ы папки-предка — независимые источники, и слабейший не должен
// понижать сильнейший. `null` — источника нет.
export const maxAccessLevel = (
  levels: readonly (EffectiveAccessLevel | null)[],
): EffectiveAccessLevel | null => {
  let highest: EffectiveAccessLevel | null = null;

  for (const level of levels) {
    if (level === null) continue;

    if (highest === null || accessRank[level] > accessRank[highest]) {
      highest = level;
    }
  }

  return highest;
};

// Роль организации и уровень share — разные шкалы. Роль `member` даёт право
// писать документы организации, но не управлять самой организацией.
const organizationRoleAccess: Record<OrganizationRole, EffectiveAccessLevel> = {
  owner: 'owner',
  admin: 'editor',
  member: 'editor',
};

export const mapOrganizationRole = (
  role: OrganizationRole,
): EffectiveAccessLevel => organizationRoleAccess[role];

// Кэш права: версия документа живёт без TTL, запись на пару «документ +
// пользователь» — с TTL. Инвалидация меняет версию, старые записи остаются в
// Redis недостижимыми и умирают сами.
export const DOCUMENT_ACCESS_CACHE_TTL_SECONDS = 60;

export const documentAccessVersionKey = (documentId: string) =>
  `acl:document:${documentId}:version`;

export const documentAccessEntryKey = (
  documentId: string,
  version: number,
  principalId: string,
) => `acl:document:${documentId}:v${version}:${principalId}`;
