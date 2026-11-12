export const S3 = Symbol('S3Client');

// TTL подписанной ссылки. Значение попадает и в подпись, и в ответ клиенту,
// поэтому живёт в одном месте.
export const SIGNED_URL_TTL_SECONDS = 900;
