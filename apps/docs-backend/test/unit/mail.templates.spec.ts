import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAIL_PROVIDER } from '../../src/mail/mail.constants';
import { MailService } from '../../src/mail/mail.service';

// Unit-уровень: SMTP здесь нет вообще. Провайдер — заглушка, конфиг — объект.
// Проверяем только то, что зависит от нашего кода: какой текст письма собран.
const APP_URL = 'https://docs.example.test';
const TO = 'user@example.com';
const TOKEN = 'Xk3pQ9vT2mR7sL4nB8cD1fG6hJ0kM5wZ_aYbCeDfGhIj';

const provider = {
  send: vi.fn(async () => ({ messageId: 'provider-message-id' })),
};

const config = {
  getOrThrow: vi.fn(() => APP_URL),
};

type SentMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const lastMail = (): SentMail => {
  const calls = provider.send.mock.calls as unknown as [SentMail][];
  expect(calls).toHaveLength(1);
  return calls[0][0];
};

const linkIn = (body: string, path: string) =>
  body.match(
    new RegExp(
      `${APP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${path}[^\\s"<]*`,
    ),
  )?.[0];

describe('MailService: шаблоны писем (unit)', () => {
  let service: MailService;

  beforeEach(async () => {
    vi.clearAllMocks();
    config.getOrThrow.mockReturnValue(APP_URL);

    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MAIL_PROVIDER, useValue: provider },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(MailService);
  });

  describe('sendVerification', () => {
    it('строит ссылку подтверждения из APP_URL и токена', async () => {
      await service.sendVerification({ to: TO, token: TOKEN, ttlHours: 24 });

      const mail = lastMail();
      expect(mail.to).toBe(TO);
      expect(mail.text).toContain(`${APP_URL}/verify-email?token=${TOKEN}`);
      expect(mail.html).toContain(`${APP_URL}/verify-email?token=${TOKEN}`);
      expect(mail.html).toMatch(
        new RegExp(`href=["']${APP_URL}/verify-email\\?token=${TOKEN}["']`),
      );
    });

    it('не удваивает слэш, если APP_URL задан со слэшем на конце', async () => {
      config.getOrThrow.mockReturnValue(`${APP_URL}/`);

      await service.sendVerification({ to: TO, token: TOKEN, ttlHours: 24 });

      const mail = lastMail();
      expect(mail.text).toContain(`${APP_URL}/verify-email?token=${TOKEN}`);
      expect(mail.text).not.toContain(`${APP_URL}//verify-email`);
    });

    it('даёт текстовую версию без html-разметки', async () => {
      await service.sendVerification({ to: TO, token: TOKEN, ttlHours: 24 });

      const mail = lastMail();
      expect(mail.text.trim()).not.toBe('');
      expect(mail.text).not.toContain('<');
      expect(mail.text).not.toContain('&nbsp;');
    });

    it('возвращает messageId провайдера', async () => {
      await expect(
        service.sendVerification({ to: TO, token: TOKEN, ttlHours: 24 }),
      ).resolves.toEqual({ messageId: 'provider-message-id' });
    });
  });

  describe('sendPasswordReset', () => {
    it('ведёт на страницу сброса пароля и не повторяет тему подтверждения', async () => {
      await service.sendVerification({ to: TO, token: TOKEN, ttlHours: 24 });
      const verificationSubject = lastMail().subject;

      provider.send.mockClear();
      await service.sendPasswordReset({ to: TO, token: TOKEN, ttlHours: 1 });

      const mail = lastMail();
      expect(linkIn(mail.text, '/reset-password')).toBe(
        `${APP_URL}/reset-password?token=${TOKEN}`,
      );
      expect(mail.subject).not.toBe(verificationSubject);
    });
  });

  describe('sendOrganizationInvite', () => {
    const ORGANIZATION = 'Acme <script>alert(1)</script>';
    const INVITER = 'owner@example.com';

    it('экранирует название организации в html-версии', async () => {
      await service.sendOrganizationInvite({
        to: TO,
        token: TOKEN,
        organizationName: ORGANIZATION,
        inviterEmail: INVITER,
      });

      const mail = lastMail();
      expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(mail.html).not.toContain('<script>');
    });

    it('оставляет название организации как есть в текстовой версии', async () => {
      await service.sendOrganizationInvite({
        to: TO,
        token: TOKEN,
        organizationName: ORGANIZATION,
        inviterEmail: INVITER,
      });

      expect(lastMail().text).toContain(ORGANIZATION);
    });

    it('называет пригласившего и даёт ссылку на приглашение', async () => {
      await service.sendOrganizationInvite({
        to: TO,
        token: TOKEN,
        organizationName: 'Acme',
        inviterEmail: INVITER,
      });

      const mail = lastMail();
      expect(mail.text).toContain(INVITER);
      expect(mail.html).toContain(INVITER);
      expect(linkIn(mail.text, '/invite')).toBe(
        `${APP_URL}/invite?token=${TOKEN}`,
      );
      expect(linkIn(mail.html ?? '', '/invite')).toBe(
        `${APP_URL}/invite?token=${TOKEN}`,
      );
    });
  });
});
