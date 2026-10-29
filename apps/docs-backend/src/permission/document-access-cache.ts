import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import {
  DOCUMENT_ACCESS_CACHE_TTL_SECONDS,
  documentAccessEntryKey,
  documentAccessVersionKey,
} from './permission.constants';
import type {
  CacheDocumentAccessKey,
  CacheDocumentAccessParams,
  EffectiveAccessLevel,
} from './permission.models';

// Кэш решения о доступе. Промах и «доступа нет» — разные ответы, поэтому
// `get` возвращает `undefined` только на промахе, а `null` — отрицательный кэш.
export type CachedDocumentAccess = EffectiveAccessLevel | null;

@Injectable()
export class DocumentAccessCache {
  constructor(private readonly redisService: RedisService) {}

  async get({
    documentId,
    principalId,
  }: CacheDocumentAccessKey): Promise<CachedDocumentAccess | undefined> {
    const versionKey = documentAccessVersionKey(documentId);
    const version = (await this.redisService.get<number>(versionKey)) ?? 0;

    const entryKey = documentAccessEntryKey(documentId, version, principalId);

    const data = await this.redisService.get<{ level: CachedDocumentAccess }>(
      entryKey,
    );

    return data?.level;
  }

  async set(params: CacheDocumentAccessParams): Promise<void> {
    const versionKey = documentAccessVersionKey(params.documentId);
    const version = (await this.redisService.get<number>(versionKey)) ?? 0;

    const entryKey = documentAccessEntryKey(
      params.documentId,
      version,
      params.principal.userId,
    );

    await this.redisService.set(
      entryKey,
      { level: params.level },
      DOCUMENT_ACCESS_CACHE_TTL_SECONDS,
    );
  }

  async invalidate(documentId: string): Promise<void> {
    const versionKey = documentAccessVersionKey(documentId);
    await this.redisService.incr(versionKey);
  }
}
