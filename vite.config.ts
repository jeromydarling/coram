/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Phase A perf: strip console/debugger from production bundles.
  esbuild:
    mode === "production"
      ? { drop: ["console", "debugger"] }
      : undefined,
  build: {
    rollupOptions: {
      output: {
        // Phase A perf: split heavy vendor libs into their own chunks so the
        // main bundle stays small and these libs are only loaded when needed.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("pdfjs-dist")) return "vendor-pdfjs";
          if (id.includes("jspdf")) return "vendor-jspdf";
          if (id.includes("react-simple-maps") || id.includes("d3-")) return "vendor-maps";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@tiptap")) return "vendor-tiptap";
          if (id.includes("recharts")) return "vendor-recharts";
          if (id.includes("@radix-ui")) return "vendor-radix";
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
