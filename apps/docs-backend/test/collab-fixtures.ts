import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export const PASSWORD = 'correct horse battery staple';
export const nextEmail = () => `user-${randomUUID()}@example.com`;

export interface Session {
  email: string;
  accessToken: string;
}

const http = (app: INestApplication) => request(app.getHttpServer());

// Регистрация и логин по HTTP — так тест получает настоящий access-токен,
// который затем предъявляет WebSocket-соединению (как это делает фронтенд).
export const registerAndLogin = async (
  app: INestApplication,
): Promise<Session> => {
  const email = nextEmail();

  await http(app).post('/auth/register').send({ email, password: PASSWORD });

  const login = await http(app)
    .post('/auth/login')
    .send({ email, password: PASSWORD });

  return { email, accessToken: login.body.accessToken as string };
};

export const createOrganization = (
  app: INestApplication,
  accessToken: string,
  name = 'Acme',
) =>
  http(app)
    .post('/organizations')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name });

export const addMember = (
  app: INestApplication,
  accessToken: string,
  organizationId: string,
  email: string,
  role = 'member',
) =>
  http(app)
    .post(`/organizations/${organizationId}/members`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ email, role });

export const createDocument = (
  app: INestApplication,
  accessToken: string,
  organizationId: string,
  title = 'Заметки',
) =>
  http(app)
    .post(`/organizations/${organizationId}/documents`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ title });
