import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { setupOpenApi } from '../../src/openapi/setup-openapi';
import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

describe('openapi (e2e)', () => {
  let app: INestApplication;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestApp();

    app = moduleRef.createNestApplication();
    await app.init();
    setupOpenApi(app);
    close = () => app.close();
  });

  afterAll(async () => {
    await close();
  });

  it('отдаёт OpenAPI-документ по /api-json', async () => {
    const res = await request(app.getHttpServer()).get('/api-json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
  });

  it('описывает маршруты документов и текущего пользователя', async () => {
    const res = await request(app.getHttpServer()).get('/api-json');

    expect(res.body.paths).toHaveProperty(
      '/organizations/{organizationId}/documents',
    );
    expect(res.body.paths).toHaveProperty('/auth/me');
  });

  it('документирует таймстемпы как строки, а не как внутренний тип', async () => {
    const res = await request(app.getHttpServer()).get('/api-json');

    expect(JSON.stringify(res.body)).toContain('"date-time"');
  });

  it('не протаскивает внутренние поля БД в схему', async () => {
    const res = await request(app.getHttpServer()).get('/api-json');
    const serialized = JSON.stringify(res.body);

    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('password_hash');
  });

  it('не ломает форму ответа /auth/me', async () => {
    const email = nextEmail();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: PASSWORD });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    expect(me.status).toBe(200);
    expect(Object.keys(me.body).sort()).toEqual(['email', 'id']);
  });
});
