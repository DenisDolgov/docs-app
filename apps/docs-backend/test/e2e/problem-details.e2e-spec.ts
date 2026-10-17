import type { INestApplication } from '@nestjs/common';
// todo линтер не видит esModuleInterop
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp } from '../utils';

describe('problem+json (RFC 9457)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('невалидный вход — 400 с полем errors', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Validation failed',
      instance: '/auth/register',
    });
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.errors[0]).toHaveProperty('message');
    expect(Array.isArray(res.body.errors[0].path)).toBe(true);
  });

  it('без сессии — 401 problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
    });
  });

  it('несуществующий маршрут — 404 problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/nope');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ title: 'Not Found', status: 404 });
  });
});
