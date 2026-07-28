import path from 'node:path';

import { defineConfig } from 'vite';

/**
 * The marketing motion bundle (§8.4).
 *
 * A separate build rather than a second input on the main one, for two
 * reasons. The main client build is driven by the Cloudflare plugin and its
 * input is the SPA's index.html; adding a second entry there means fighting
 * that plugin's environment config for no benefit. And this bundle wants the
 * opposite of the SPA's settings — no code splitting, no shared vendor chunk,
 * one self-contained file, because it is fetched once by a page whose whole
 * budget is 1.5s to LCP and a waterfall of two module requests to animate a
 * hero is a bad trade.
 *
 * Runs after the main build with `emptyOutDir: false`, so it lands beside the
 * SPA in dist/client without wiping it.
 *
 * The filename is stable rather than hashed. A hashed name would need the
 * Worker to read the client manifest at build time, which introduces an
 * ordering dependency between two builds to save re-fetching ~14kB that
 * changes only when the marketing animations change. `public/_headers` gives
 * it a five-minute cache with stale-while-revalidate instead.
 */
export default defineConfig({
  resolve: {
    alias: { '@shared': path.resolve(__dirname, './src/shared') },
  },

  /*
   * framer-motion branches on process.env.NODE_ENV for its dev warnings. A
   * `lib` build does not substitute it the way an app build does, so without
   * this the bundle throws "process is not defined" on the first line it runs
   * and every animation on the page silently does not happen.
   */
  define: { 'process.env.NODE_ENV': '"production"' },

  build: {
    outDir: 'dist/client/marketing',
    emptyOutDir: false,
    // Safari 15 / Firefox ESR floor. Above this the bundle grows for browsers
    // that will not visit an organizing tool's marketing page.
    target: 'es2020',
    lib: {
      entry: path.resolve(__dirname, 'src/marketing/motion.ts'),
      formats: ['es'],
      fileName: () => 'motion.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
