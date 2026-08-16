// Plugins
import Components from "unplugin-vue-components/vite";
import Vue from "@vitejs/plugin-vue";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import Fonts from "unplugin-fonts/vite";
import VueRouter from "unplugin-vue-router/vite";
import { VitePWA } from "vite-plugin-pwa";

// Utilities
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    VueRouter(),
    Vue({
      template: { transformAssetUrls },
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: "src/styles/settings.scss",
      },
    }),
    Components(),
    Fonts({
      fontsource: {
        families: [
          {
            name: "Roboto",
            weights: [100, 300, 400, 500, 700, 900],
            styles: ["normal", "italic"],
          },
        ],
      },
    }),
    VitePWA({
      // No push/notificationclick handling needed (hbakery has no
      // notification system), so the auto-generated service worker
      // (offline app-shell precache + navigation fallback) is enough —
      // no reason to hand-write one via injectManifest.
      strategies: "generateSW",
      registerType: "autoUpdate",
      workbox: {
        // A couple of the app's JS chunks run past the default 2MB
        // precache ceiling; without raising it those chunks are silently
        // dropped from the offline shell instead of erroring loudly.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // The backend's own API routes must never be answered from the
        // precached shell — an offline "200 index.html" standing in for
        // real data would be worse than the app's normal error state.
        navigateFallbackDenylist: [
          // Lowercase only, deliberately: the API path is /orders while
          // the SPA's own page is /Orders, and these must not collide.
          /^\/(users|items|units|outlets|purchases|products|productions|productionPlans|stocktransfers|sales|productOut|expenditures|staffs|loans|payables|payroll|customers|reports|auth|roles|tasks|isTokenActive|auditlog|orders|geo|customerAuth|shop|boards|boardForms)(\/|$)/,
        ],
      },
      manifest: {
        name: "Hanein Bakery — Bakery Management System",
        short_name: "Hanein Bakery",
        description:
          "Production, sales, stock and staff management for Hanein Bakery.",
        theme_color: "#1867C0",
        background_color: "#1867C0",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "en",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  optimizeDeps: {
    exclude: [
      "vuetify",
      "vue-router",
      "unplugin-vue-router/runtime",
      "unplugin-vue-router/data-loaders",
      "unplugin-vue-router/data-loaders/basic",
    ],
  },
  define: { "process.env": {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".js", ".json", ".jsx", ".mjs", ".ts", ".tsx", ".vue"],
  },
  server: {
    proxy: {
      "^/users": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/units": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/items": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/purchases": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/products": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/outlets": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/productions": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/productionPlans": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/stocktransfers": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/sales": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/productOut": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/expenditures": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/staffs": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/customers": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/loans": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/payables": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/reports": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/auth": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/isTokenActive": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/roles": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/tasks": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/auditlog": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
    },
  },
  css: {
    preprocessorOptions: {
      sass: {
        api: "modern-compiler",
      },
      scss: {
        api: "modern-compiler",
      },
    },
  },
});
