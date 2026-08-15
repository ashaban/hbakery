import Vue from "@vitejs/plugin-vue";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// This app ships only as an Android APK — it is never deployed as a web
// site, so there is no PWA plugin here and nothing writes into
// backend/gui. `npm run build` exists purely to produce the bundle that
// Capacitor copies into the native project.
export default defineConfig({
  plugins: [
    Vue({ template: { transformAssetUrls } }),
    Vuetify({ autoImport: true }),
  ],
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  build: {
    // Capacitor serves these from the device, so a slightly larger
    // single bundle beats many small ones — there is no network to
    // parallelise against.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 3010,
    // Local browser testing talks to the dev backend; the packaged app
    // uses the absolute URL in src/lib/api.js instead.
    proxy: {
      "/geo": "http://localhost:3007",
      "/customerAuth": "http://localhost:3007",
      "/shop": "http://localhost:3007",
    },
  },
});
