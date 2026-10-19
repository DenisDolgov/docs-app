import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['test/integration/*.integration-spec.ts'],
    globals: true,
    root: './',
    // Файлы делят один MailHog, а `beforeEach` чистит его целиком. При
    // параллельном прогоне один файл стирает письмо, которого ждёт другой.
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-e2e.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
