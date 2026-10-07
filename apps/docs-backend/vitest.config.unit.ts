import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    include: ['test/unit/**/*.spec.ts'],
    globals: true,
    root: './',
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
