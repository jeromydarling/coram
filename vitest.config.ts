import path from 'node:path';

import { defineConfig } from 'vitest/config';

/**
 * Separate from vite.config.ts on purpose: that one loads the Cloudflare
 * plugin, which wants to build a Worker and does not belong in a unit test run.
 *
 * The lib tests here are pure — WebCrypto, the retention registry — and run
 * under Node. Tests that need real bindings (KV, R2, Hyperdrive) belong in a
 * workers-pool config, which lands when there is a route worth testing that way.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
