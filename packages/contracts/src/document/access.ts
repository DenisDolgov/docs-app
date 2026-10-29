// Уровни доступа к документу — источник истины для клиента и для `pgEnum`
// таблицы share. Порядок уровней в наборе не задаёт иерархию: сравнение живёт
// в бэкенде (`permission.constants.ts`), потому что это доменное правило.
//
// `owner` здесь нет намеренно: владелец не выдаётся строкой share, он
// вычисляется из документа и роли в организации.
export const documentAccessLevels = ['viewer', 'commenter', 'editor'] as const;

export type DocumentAccessLevel = (typeof documentAccessLevels)[number];
