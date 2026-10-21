import { randomUUID } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/auth/auth.service';
import { DATABASE, type Database } from '../../src/database/database.constants';
import { DocumentService } from '../../src/document/document.service';
import { MAIL_PROVIDER } from '../../src/mail/mail.constants';
import type { OutgoingMail } from '../../src/mail/mail.models';
import { OrganizationService } from '../../src/organization/organization.service';

// Что видно и что разрешено неподтверждённому пользователю. Реальная Postgres,
// без HTTP: проверяем чтение флага и решение политики, а не обвязку маршрутов.
const PASSWORD = 'correct horse battery staple';
const nextEmail = () => `user-${randomUUID()}@example.com`;

const VERIFY_LINK = /\/verify-email\?token=([A-Za-z0-9_-]+)/;

const provider = {
  send: vi.fn<(mail: OutgoingMail) => Promise<{ messageId: string }>>(
    async () => ({ messageId: 'stub' }),
  ),
};

describe('email verified (integration)', () => {
  let auth: AuthService;
  let organizationService: OrganizationService;
  let documentService: DocumentService;
  let db: Database;
  let close: () => Promise<void>;

  const register = async () => {
    const email = nextEmail();
    const user = await auth.register({ email, password: PASSWORD });

    return { email, id: user.id };
  };

  // Подтверждаем адрес тем же путём, что и человек: достаём токен из письма
  // конкретному получателю. В базе лежит только хеш, открытый токен живёт
  // в письме. Ищем по адресу, а не по «последнему письму»: иначе тест сломается,
  // если рядом появится ещё одна отправка.
  const verifyEmail = async (email: string) => {
    const mail = provider.send.mock.calls.findLast(
      ([sent]) => sent.to === email,
    );

    if (!mail) throw new Error(`письмо для ${email} не отправлялось`);

    const match = mail[0].text.match(VERIFY_LINK);

    if (!match) throw new Error('в письме нет ссылки подтверждения');

    await auth.verifyEmail(match[1]);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL_PROVIDER)
      .useValue(provider)
      .compile();

    auth = moduleRef.get(AuthService);
    organizationService = moduleRef.get(OrganizationService);
    documentService = moduleRef.get(DocumentService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  beforeEach(() => {
    provider.send.mockReset();
    provider.send.mockImplementation(async () => ({ messageId: 'stub' }));
  });

  it('до подтверждения профиль отдаёт emailVerified: false', async () => {
    const { id, email } = await register();

    await expect(auth.getProfile(id)).resolves.toEqual({
      id,
      email,
      emailVerified: false,
    });
  });

  it('после подтверждения профиль отдаёт emailVerified: true', async () => {
    const { id, email } = await register();

    await verifyEmail(email);

    await expect(auth.getProfile(id)).resolves.toEqual({
      id,
      email,
      emailVerified: true,
    });
  });

  it('профиль удалённого пользователя — не 200 и не 500', async () => {
    await expect(auth.getProfile(randomUUID())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('неподтверждённый пользователь не создаёт организацию', async () => {
    const { id } = await register();

    await expect(
      organizationService.create({ userId: id, name: 'Acme' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Отказ должен случиться до записи: пустая организация без владельца —
    // такой же баг, как и созданная.
    await expect(organizationService.listForUser(id)).resolves.toEqual([]);
  });

  it('неподтверждённый владелец не добавляет участника', async () => {
    const owner = await register();

    // Организацию создаёт только подтверждённый пользователь, поэтому владелец
    // сначала проходит обычный путь подтверждения.
    await verifyEmail(owner.email);

    const target = await register();

    const organization = await organizationService.create({
      userId: owner.id,
      name: 'Acme',
    });

    // Состояние «был подтверждён, потом адрес сменили»: организация и роль уже
    // есть, а флага снова нет. Тест готовит его через SQL, потому что смены email
    // в продукте пока нет.
    await db.execute(
      sql`update auth.users set email_verified_at = null where id = ${owner.id}`,
    );

    await expect(
      organizationService.addMember({
        organizationId: organization.id,
        actorId: owner.id,
        email: target.email,
        role: 'member',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Отказ должен случиться до записи: участника в организации быть не должно.
    const members = await organizationService.listMembers({
      organizationId: organization.id,
      actorId: owner.id,
    });

    expect(members.map((member) => member.userId)).toEqual([owner.id]);
  });

  it('после подтверждения организация создаётся как раньше', async () => {
    const { id, email } = await register();

    await verifyEmail(email);

    const organization = await organizationService.create({
      userId: id,
      name: 'Acme',
    });

    expect(organization).toMatchObject({ name: 'Acme' });
    await expect(organizationService.listForUser(id)).resolves.toEqual([
      expect.objectContaining({ name: 'Acme', role: 'owner' }),
    ]);
  });

  it('неподтверждённый пользователь работает с личными документами', async () => {
    const { id } = await register();

    const document = await documentService.createPersonal({
      actorId: id,
      title: 'Личное',
    });

    await expect(
      documentService.get({ documentId: document.id, actorId: id }),
    ).resolves.toMatchObject({ id: document.id, title: 'Личное' });
  });
});
