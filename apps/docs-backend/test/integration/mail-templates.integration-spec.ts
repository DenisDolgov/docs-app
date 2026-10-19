import { simpleParser } from 'mailparser';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { MailService } from '../../src/mail/mail.service';
import { createTestingModule, waitFor } from '../utils';

// Второй срез почты: шаблон прошёл через настоящий SMTP и MIME-кодирование.
// Тест читает то, что видит почтовый клиент: письмо разбирает `mailparser`, а не
// наш код. Кодировки, boundary и transfer-encoding — забота транспорта, поэтому
// здесь их нет: проверяем собранное содержимое, а не формат nodemailer.
const MAILHOG = 'http://localhost:8025';
const RECIPIENT = 'template-mail@example.com';
const TOKEN = 'Xk3pQ9vT2mR7sL4nB8cD1fG6hJ0kM5wZ_aYbCeDfGhIj';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

type MailhogMessage = {
  // `Raw.Data` — письмо целиком, вместе с заголовками: `Content.Body` содержит
  // только MIME-тело, и тему из него не достать.
  Raw: {
    Data: string;
  };
};

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

const parseInbox = async () => {
  const items = await inbox();

  return Promise.all(items.map((item) => simpleParser(item.Raw.Data)));
};

const onlyMessage = async () => {
  await waitFor(async () => (await inbox()).length > 0);
  const items = await inbox();
  expect(items).toHaveLength(1);

  return simpleParser(items[0].Raw.Data);
};

describe('mail: шаблоны писем', () => {
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

  beforeEach(async () => {
    await clearMailhog();
  });

  it('доносит ссылку подтверждения до почтового клиента в обеих версиях', async () => {
    await mail.sendVerification({ to: RECIPIENT, token: TOKEN });

    const message = await onlyMessage();
    const link = `${APP_URL}/verify-email?token=${TOKEN}`;

    expect(message.text).toContain(link);
    expect(message.html).toContain(`href="${link}"`);
  });

  it('отправляет читаемую тему и обе части письма', async () => {
    await mail.sendVerification({ to: RECIPIENT, token: TOKEN });

    const message = await onlyMessage();

    expect(message.subject).toMatch(/подтвержд/i);
    expect(message.text?.trim()).not.toBe('');
    expect(message.html?.trim()).not.toBe('');
  });

  it('не смешивает письма разных сценариев', async () => {
    await mail.sendVerification({ to: RECIPIENT, token: TOKEN });
    await mail.sendPasswordReset({ to: RECIPIENT, token: TOKEN });

    await waitFor(async () => (await inbox()).length === 2);
    const messages = await parseInbox();

    expect(
      messages.filter((m) => m.text?.includes('/verify-email')),
    ).toHaveLength(1);
    expect(
      messages.filter((m) => m.text?.includes('/reset-password')),
    ).toHaveLength(1);
  });
});
