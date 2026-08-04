import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      // injectManifest, nu generateSW: vrem control explicit peste
      // rutare/strategii Workbox (vezi src/sw/sw.ts) — de exemplu
      // regula NetworkOnly care ține Workbox departe de /products și
      // /transactions — în loc să acceptăm ce deduce generateSW
      // automat.
      strategies: "injectManifest",
      srcDir: "src/sw",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      devOptions: {
        // Rulează SW-ul și în `vite dev`, nu doar la build — altfel nu
        // poți testa offline-first-ul decât după un build de producție.
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "POS Self-Checkout",
        short_name: "POS",
        start_url: "/",
        display: "standalone",
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5173 },
});
