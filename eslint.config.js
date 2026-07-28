import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  /*
   * The SPA has no database client. Under Hyperdrive the browser talks to
   * /api/* and nothing else, so a direct `postgres` import here would not be a
   * style problem — it would mean a connection string heading into a bundle
   * that ships to the public.
   */
  {
    files: ['src/app/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'postgres',
              message: 'The SPA has no database access. Call an /api route instead.',
            },
          ],
          patterns: [
            {
              group: ['**/worker/**'],
              message:
                'The SPA must not import Worker code. Share types and Zod schemas through src/shared instead.',
            },
          ],
        },
      ],
    },
  },

  /*
   * §4.2: "There is no service-role query path in any request handler —
   * service-role is reserved for cron jobs."
   *
   * connectAsCron() opens a BYPASSRLS connection. Reaching for it from a route
   * is the one mistake in this codebase that would silently switch off
   * multi-tenant isolation, so it is an error here rather than a convention.
   */
  {
    files: ['src/worker/routes/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.worker },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '../../lib/rls',
              importNames: ['connectAsCron'],
              message:
                'connectAsCron bypasses RLS and is for cron and queue consumers only (§4.2). Use connect() with withTenant().',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/worker/**/*.{ts,tsx}', 'scripts/**/*.ts'],
    languageOptions: { globals: { ...globals.worker, ...globals.node } },
  },
);
