import { Writable } from 'node:stream';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../../src/app.module';
import { createLoggerParams } from '../../src/logger/logger.config';

function getLogRecords(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

describe('request logging', () => {
  const lines: string[] = [];
  let app: INestApplication;

  beforeAll(async () => {
    const stream = new Writable({
      write(chunk, _encodeing, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue(createLoggerParams({ get: () => 'test' }, stream))
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.init();
  });

  afterEach(() => {
    lines.length = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('логирует запрос с correlation id', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .set('x-request-id', 'req-42');

    const records = getLogRecords(lines);
    const requestLog = records.find(
      (record) => record.msg === 'request completed',
    );
    expect(requestLog).toBeDefined();
    expect(requestLog.req.id).toBe('req-42');
  });

  it('связывает лог сервиса с запросом', async () => {
    await request(app.getHttpServer()).get('/health');

    const records = getLogRecords(lines);
    const serviceLog = records.find(
      (record) => record.context === 'HealthService',
    );

    expect(serviceLog).toBeDefined();
    expect(serviceLog.req.id).toBeDefined();
  });
});
