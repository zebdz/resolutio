/** Explicit PostgreSQL acceptance suite. Missing or unsafe test URLs fail in
 * the harness; ordinary unit runs never connect to an application database. */
import { defineConfig } from 'vitest/config';
import base from './vitest.config';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'src/infrastructure/repositories/__tests__/*.database.test.ts',
      'src/infrastructure/repositories/__tests__/*.dbConstraint.test.ts',
    ],
    exclude: [],
    fileParallelism: false,
  },
});
