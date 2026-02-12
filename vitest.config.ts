import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.next/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  resolve: {
    alias: [
      { find: '@/src', replacement: path.resolve(__dirname, './src') },
      {
        find: '@/domain',
        replacement: path.resolve(__dirname, './src/domain'),
      },
      {
        find: '@/application',
        replacement: path.resolve(__dirname, './src/application'),
      },
      {
        find: '@/infrastructure',
        replacement: path.resolve(__dirname, './src/infrastructure'),
      },
      { find: '@/web', replacement: path.resolve(__dirname, './src/web') },
      { find: '@', replacement: path.resolve(__dirname, './') },
    ],
  },
});
