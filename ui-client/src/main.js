import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";
import { isNative, setUnauthorizedHandler } from "@/lib/api";
import { ensureSessionRestored, signOut } from "@/lib/auth";
import { loadCart } from "@/lib/cart";
import { i18n, restoreLanguage, t } from "@/lib/i18n";
import { notify } from "@/lib/toast";

const app = createApp(App);
app.use(i18n);
app.use(router);
app.use(vuetify);
app.mount("#app");

// Applied before anything user-visible needs it. Kiswahili is already
// the default, so a slow read here shows the right language either way.
restoreLanguage();

// A rejected token anywhere in the app drops back to the welcome screen
// once, from a single place, rather than every caller handling it.
setUnauthorizedHandler(async () => {
  await signOut();
  router.replace({ name: "Welcome" });
});

// Kick the session restore off immediately rather than waiting for the
// first navigation to trigger it; the router's guard awaits the same
// promise, so the first route resolves as soon as this settles.
ensureSessionRestored();
loadCart();

if (isNative()) {
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      StatusBar.setBackgroundColor({ color: "#1867C0" });
      // Style.Dark means light (white) status bar text — correct against
      // this dark blue, despite how the name reads.
      StatusBar.setStyle({ style: Style.Dark });
    })
    .catch(() => {
      /* Not fatal — the default status bar still works. */
    });

  // Android's back button: close the top overlay, else go back, else
  // minimise. Never exit outright from the shop screen, and never sign
  // the customer out.
  import("@capacitor/app")
    .then(({ App: CapApp }) => {
      let lastBackPress = 0;

      CapApp.addListener("backButton", () => {
        // Vuetify's snackbar is itself rendered as a v-overlay, so the
        // "press back again to close" toast we show below was matching
        // this check on the second press — the back press dismissed the
        // toast instead of counting toward minimising, and the app could
        // never be minimised this way. Real dialogs/menus/bottom-sheets
        // still match and get closed as before.
        const overlay = document.querySelector(
          ".v-overlay--active:not(.v-snackbar)",
        );
        if (overlay) {
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
          );
          return;
        }

        const path = router.currentRoute.value.path;
        const atTop = ["/shop", "/welcome"].includes(path);

        if (!atTop) {
          if (window.history.state?.back) router.back();
          else router.replace("/shop");
          return;
        }

        // At the top level, require a second press — a stray back tap
        // shouldn't drop someone out of a half-built order.
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          CapApp.minimizeApp();
        } else {
          lastBackPress = now;
          notify(t("back.pressAgain"), "info");
        }
      });
    })
    .catch(() => {});
}
