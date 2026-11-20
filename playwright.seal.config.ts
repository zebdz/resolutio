/** Start a separate loopback dev server with a simulated anchor and disabled email for the seal rehearsal. */
import { defineConfig } from '@playwright/test';
import { localSealDatabase } from './e2e/sealDatabase';

const database = localSealDatabase();
export default defineConfig({
  testDir: './e2e',
  testMatch: 'poll-seal.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:55441',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'yarn next dev --webpack -H 127.0.0.1 -p 55441',
    port: 55441,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: database,
      ANCHOR_PROVIDER: 'stub',
      ANCHOR_POLLER_SECRET: 'seal-browser-test',
      SMTP_HOST: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
