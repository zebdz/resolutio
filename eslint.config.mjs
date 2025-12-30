import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Only disables conflicting rules - it doesn't run Prettier.
  prettierConfig,
  {
    plugins: {
      // Runs Prettier as an ESLint rule
      prettier: prettierPlugin,
    },
    rules: {
      // Enforce curly braces for all control statements
      curly: ['error', 'all'],
      // Enforce blank line before return statements and after block-like statements
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // temporarily disable TODO: enable later
      '@typescript-eslint/no-unused-vars': 'off', // temporarily disable TODO: enable later
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'generated/**',
  ]),
]);

export default eslintConfig;
