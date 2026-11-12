// Жизненный цикл файла: строка появляется до загрузки (`pending`) и становится
// видимой после проверки объекта в хранилище (`ready`). Набор — источник
// истины для `pgEnum` в БД.
export const fileStatuses = ['pending', 'ready'] as const;

export type FileStatus = (typeof fileStatuses)[number];
