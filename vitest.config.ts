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
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/src': path.resolve(__dirname, './src'),
      '@/domain': path.resolve(__dirname, './src/domain'),
      '@/application': path.resolve(__dirname, './src/application'),
      '@/infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@/web': path.resolve(__dirname, './src/web'),
    },
  },
});
