import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadAppModule = async () => {
  vi.resetModules();
  const { AppModule } = await import('../../src/app.module');
  return AppModule;
};

describe('env config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('приводит PORT к числу', async () => {
    vi.stubEnv('PORT', '4000');

    const AppModule = await loadAppModule();
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const config = ref.get(ConfigService);

    expect(config.get('PORT')).toBe(4000);

    await ref.close();
  });

  it('не стартует без DATABASE_URL', async () => {
    vi.stubEnv('DATABASE_URL', '');

    const AppModule = await loadAppModule();
    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  it('приводит COOKIE_SECURE к boolean и читает остальные cookie-настройки', async () => {
    vi.stubEnv('COOKIE_SECURE', 'false');
    vi.stubEnv('COOKIE_SAMESITE', 'lax');
    vi.stubEnv('COOKIE_DOMAIN', 'docs.example.test');

    const AppModule = await loadAppModule();
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const config = ref.get(ConfigService);

    // `z.coerce.boolean()` здесь ошибочен: Boolean('false') === true.
    expect(config.get('COOKIE_SECURE')).toBe(false);
    expect(config.get('COOKIE_SAMESITE')).toBe('lax');
    expect(config.get('COOKIE_DOMAIN')).toBe('docs.example.test');

    await ref.close();
  });

  it('не стартует с SameSite=None без Secure', async () => {
    vi.stubEnv('COOKIE_SAMESITE', 'none');
    vi.stubEnv('COOKIE_SECURE', 'false');

    const AppModule = await loadAppModule();
    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).rejects.toThrow(/COOKIE_SECURE|COOKIE_SAMESITE|SameSite/);
  });
});
