import path from 'node:path';

import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

/**
 * One build, one deploy (§1.5). The Cloudflare plugin reads wrangler.toml,
 * builds the Worker from its `main`, and emits the SPA to dist/client where
 * the [assets] binding picks it up.
 */
export default defineConfig({
  plugins: [react(), cloudflare()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Marketing-only, and §8.4 keeps it out of /app entirely. Splitting
          // it means the product shell never pays for it.
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          return undefined;
        },
      },
    },
  },
});
