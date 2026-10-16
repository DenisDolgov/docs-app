import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../utils';

const PASSWORD = 'correct horse battery staple';
const ALLOWED_ORIGIN = 'http://localhost:3000';
const FOREIGN_ORIGIN = 'http://evil.example';

describe('Origin guard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const register = async () => {
    const email = `user-${randomUUID()}@example.com`;

    await request(app.getHttpServer())
      .post('/auth/register')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email, password: PASSWORD });

    return email;
  };

  it('отклоняет изменяющий запрос с чужого origin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', FOREIGN_ORIGIN)
      .send({ email: 'user@example.com', password: PASSWORD });

    expect(res.status).toBe(403);
  });

  it('пропускает изменяющий запрос без Origin (curl, server-to-server)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: PASSWORD });

    // не 403: запрос дошёл до обработчика и упал на неверных данных
    expect(res.status).toBe(401);
  });

  it('пропускает изменяющий запрос с разрешённого origin', async () => {
    const email = await register();

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', ALLOWED_ORIGIN)
      .send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
  });

  it('не трогает безопасные GET-запросы с чужого origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', FOREIGN_ORIGIN);

    expect(res.status).toBeLessThan(400);
  });
});
