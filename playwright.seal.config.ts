/** Isolate seal rehearsals on loopback with disabled mail. Frozen protocol coverage also runs against a production build. */
import { defineConfig } from '@playwright/test';
import { localSealDatabase } from './e2e/sealDatabase';

const database = localSealDatabase();
const built = process.env.SEAL_BROWSER_SERVER === 'production';
export default defineConfig({
  testDir: './e2e',
  testMatch: built
    ? 'sealed-protocols.spec.ts'
    : ['poll-seal.spec.ts', 'sealed-protocols.spec.ts'],
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:55441',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: built
      ? 'yarn next start -H 127.0.0.1 -p 55441'
      : 'yarn next dev --webpack -H 127.0.0.1 -p 55441',
    // Wait for a real route, since Next dev can accept TCP before its route manifest is ready.
    url: 'http://127.0.0.1:55441/en/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: database,
      ANCHOR_PROVIDER: built ? 'opentimestamps' : 'stub',
      OTS_CALENDAR_URLS: 'http://127.0.0.1:55440',
      ANCHOR_POLLER_SECRET: 'seal-browser-test',
      SMTP_HOST: '',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
