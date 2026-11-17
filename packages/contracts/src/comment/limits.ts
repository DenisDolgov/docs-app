// Пределы комментария общие для клиента и сервера: клиент режет ввод по ним,
// сервер проверяет те же числа схемой, а не «на глаз».
export const MAX_COMMENT_BODY_LENGTH = 5000;

// Длина base64-строки relative position: сам Yjs-якорь — единицы байт,
// запас нужен только на служебные поля и будущую версию формата.
export const MAX_COMMENT_ANCHOR_POSITION_LENGTH = 8192;

// Запасной текст фрагмента: он показывается, когда якорь не восстановился.
export const MAX_COMMENT_ANCHOR_QUOTE_LENGTH = 500;
