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
      // NetworkOnly rule that keeps Workbox away from /products and
      // /transactions — instead of accepting whatever generateSW
      // infers automatically.
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
});
