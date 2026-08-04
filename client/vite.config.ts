import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      // injectManifest, not generateSW: we want explicit control over
      // Workbox routing/strategies (see src/sw/sw.ts) — e.g. the
      // NetworkOnly rule that keeps Workbox away from /products, and
      // the Background Sync queue on /transactions — instead of
      // accepting whatever generateSW infers automatically.
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      devOptions: {
        // Run the SW in `vite dev` too, not just on build — otherwise
        // offline-first can only be tested after a production build.
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "POS Self-Checkout",
        short_name: "POS",
        start_url: "/",
        display: "standalone",
        theme_color: "#2563eb",
        background_color: "#ffffff",
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Vendor code split out of the app chunk for long-term caching.
        // Note: workbox-* packages live in the separate SW build
        // (vite-plugin-pwa's injectManifest), not here — vendor-workbox
        // is for any client-side workbox import (e.g. workbox-window),
        // should this app add one. Function form so this doesn't break
        // silently if a dependency's subpath imports change.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (/[\\/]node_modules[\\/](vue|vue-router|@vue)[\\/]/.test(id)) {
            return "vendor-vue";
          }
          if (/[\\/]node_modules[\\/]pinia[\\/]/.test(id)) {
            return "vendor-pinia";
          }
          if (/[\\/]node_modules[\\/]workbox-window[\\/]/.test(id)) {
            return "vendor-workbox";
          }
          if (/[\\/]node_modules[\\/](idb|@vueuse)[\\/]/.test(id)) {
            return "vendor-data";
          }
          return "vendor";
        },
      },
    },
  },
});
