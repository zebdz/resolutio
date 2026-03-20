import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disables ESLint rules that conflict with Prettier.
  prettierConfig,
  {
    rules: {
      // Enforce curly braces for all control statements
      curly: ['error', 'all'],
      // Enforce blank lines around block-like statements and before return
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' },
        { blankLine: 'always', prev: '*', next: 'block-like' },
        { blankLine: 'always', prev: 'block-like', next: '*' },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // temporarily disable TODO: enable later
      '@typescript-eslint/no-unused-vars': 'off', // temporarily disable TODO: enable later
      'react-hooks/incompatible-library': 'off', // @tanstack/react-virtual not yet compatible with React Compiler
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
