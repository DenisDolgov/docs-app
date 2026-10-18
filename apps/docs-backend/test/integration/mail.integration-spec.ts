import net from 'node:net';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { MAIL_PROVIDER } from '../../src/mail/mail.constants';
import { MailModule } from '../../src/mail/mail.module';
import { MailService } from '../../src/mail/mail.service';
import { createTestingModule, waitFor } from '../utils';

// MailHog — фейковый SMTP-сервер из docker-compose. Письма он не отправляет,
// а складывает в память; смотреть их можно в UI (http://localhost:8025) или
// через HTTP API. Тест использует API как независимый оракул: он ничего не
// знает про наш MailProvider и читает то, что реально дошло по SMTP.
const MAILHOG = 'http://localhost:8025';
const SMTP_PORT = 1025;
const RECIPIENT = 'test-mail@example.com';

type MailhogAddress = { Mailbox: string; Domain: string };

type MailhogMessage = {
  From: MailhogAddress;
  To: MailhogAddress[];
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
  };
};

// SMTP_FROM задан как "Docs <noreply@docs.local>"; проверяем, что адаптер берёт
// отправителя из конфига, а не хардкодит его.
const configuredSender = () => {
  const raw = process.env.SMTP_FROM ?? '';
  const match = raw.match(/<([^>]+)>/);

  return match ? match[1] : raw;
};

const probePort = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });

const clearMailhog = async () => {
  const response = await fetch(`${MAILHOG}/api/v1/messages`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`MailHog не очистился: ${response.status}`);
  }
};

const inbox = async (): Promise<MailhogMessage[]> => {
  const query = new URLSearchParams({ kind: 'to', query: RECIPIENT });
  const response = await fetch(`${MAILHOG}/api/v2/search?${query}`);

  if (!response.ok) {
    throw new Error(`MailHog API ответил ${response.status}`);
  }

  const data = (await response.json()) as { items: MailhogMessage[] };

  return data.items;
};

const onlyMessage = async () => {
  await waitFor(async () => (await inbox()).length > 0);

  return (await inbox())[0];
};

describe('mail', () => {
  let mail: MailService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await createTestingModule();

    mail = moduleRef.get(MailService);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    await close();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await clearMailhog();
  });

  it('поднимает MailHog в инфраструктуре', async () => {
    expect(await probePort('localhost', SMTP_PORT)).toBe(true);
    await expect(fetch(`${MAILHOG}/`)).resolves.toMatchObject({ status: 200 });
  });

  it('связывает MailService с провайдером через DI-токен', async () => {
    const moduleRef = await createTestingModule();

    expect(moduleRef.get(MAIL_PROVIDER, { strict: false })).toBeDefined();
    expect(moduleRef.get(MailService)).toBeInstanceOf(MailService);

    await moduleRef.close();
  });

  it('доставляет письмо по SMTP, и оно видно в MailHog', async () => {
    const subject = 'Docs: transport check';
    const text = 'TEXT-PART-MARKER';

    const sent = await mail.send({ to: RECIPIENT, subject, text });

    expect(sent.messageId).toEqual(expect.any(String));

    const message = await onlyMessage();

    expect(message.To[0]).toMatchObject({ Mailbox: 'test-mail' });
    expect(message.Content.Headers.Subject).toContain(subject);
    expect(message.Content.Body).toContain(text);
  });

  it('кладёт html-версию рядом с текстовой и берёт отправителя из конфига', async () => {
    const text = 'TEXT-ALTERNATIVE-MARKER';
    const html = '<p>HTML-ALTERNATIVE-MARKER</p>';

    await mail.send({
      to: RECIPIENT,
      subject: 'Docs: alternatives',
      text,
      html,
    });

    const message = await onlyMessage();

    expect(message.Content.Headers['Content-Type']?.[0]).toMatch(
      /^multipart\/alternative/,
    );
    expect(message.Content.Body).toContain(text);
    expect(message.Content.Body).toContain('HTML-ALTERNATIVE-MARKER');
    expect(`${message.From.Mailbox}@${message.From.Domain}`).toBe(
      configuredSender(),
    );
  });

  it('не ходит в SMTP, когда выбран MAIL_TRANSPORT=log', async () => {
    // SMTP указывает на живой MailHog: если реализация проигнорирует
    // MAIL_TRANSPORT и отправит письмо, оно доедет — и тест это увидит.
    vi.stubEnv('MAIL_TRANSPORT', 'log');

    const logModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        MailModule,
      ],
    }).compile();

    await expect(
      logModule.get(MailService).send({
        to: RECIPIENT,
        subject: 'Docs: logged only',
        text: 'LOG-TRANSPORT-MARKER',
      }),
    ).resolves.toMatchObject({ messageId: expect.any(String) });

    await logModule.close();

    await expect(inbox()).resolves.toHaveLength(0);
  });

  it('не стартует с неизвестным MAIL_TRANSPORT', async () => {
    vi.stubEnv('MAIL_TRANSPORT', 'carrier-pigeon');
    vi.resetModules();

    // Приложение перечитываем заново: схема окружения проверяется при сборке
    // модуля, и уже загруженный AppModule новое значение не увидит.
    const boot = async () => {
      const { AppModule } = await import('../../src/app.module');

      return Test.createTestingModule({ imports: [AppModule] }).compile();
    };

    await expect(boot()).rejects.toThrow(/MAIL_TRANSPORT/);
  });
});
