// Внутренние тайминги коллаборации. Протокольные константы (путь WS, opcodes,
// коды закрытия) живут в контракте — `@docs-app/contracts/collab/protocol`.

// Интервал сохранения снэпшота документа
export const COLLAB_SAVE_INTERVAL = 5 * 60 * 1000;
// Интервал записи обновлений документа в БД
export const COLLAB_FLUSH_INTERVAL = 250;
// Время отсрочки до отчистки комнаты
export const COLLAB_EVICT_GRACE = 30 * 1000;
export const COLLAB_HYDRATION_ORIGIN = Symbol('collab-hydration');
