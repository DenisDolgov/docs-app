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
});
