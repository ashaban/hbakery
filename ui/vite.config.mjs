// Plugins
import Components from "unplugin-vue-components/vite";
import Vue from "@vitejs/plugin-vue";
import Vuetify, { transformAssetUrls } from "vite-plugin-vuetify";
import Fonts from "unplugin-fonts/vite";
import VueRouter from "unplugin-vue-router/vite";

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
      "^/stocktransfers": {
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
      "^/reports": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/login": {
        target: "http://localhost:3007/",
        logLevel: "debug",
      },
      "^/isTokenActive": {
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
