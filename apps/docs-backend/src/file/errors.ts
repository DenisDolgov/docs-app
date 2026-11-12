// Файл, которого нет или на который нет права, отвечает одинаково: иначе
// `fileId` можно перебирать и узнавать о существовании чужих вложений.
export const FILE_NOT_FOUND_ERROR = 'File not found';

export const FILE_UPLOAD_MIME_ERROR = 'This file type is not allowed';
export const FILE_UPLOAD_SIZE_ERROR = 'File size is outside the allowed range';
export const FILE_UPLOAD_MISSING_ERROR = 'Uploaded object not found';

export const FILE_REMOVE_STORAGE_ERROR = 'Cannot remove object from storage';
