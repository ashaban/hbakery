import { isNative } from "@/lib/platform";

/**
 * The Android hardware/gesture back button.
 *
 * Without this the WebView's own default applies, which does nothing
 * once there is no page history left — so the app sits on the dashboard
 * refusing to go anywhere, when every other Android app would have
 * minimised. Android users read that as the app being stuck.
 *
 * The order below is what Android users expect:
 *   1. an open dialog/menu closes
 *   2. otherwise go back a screen
 *   3. at the top of the app, minimise — never sign out, and never exit
 *      outright, so returning is instant and the session survives.
 */
export async function attachNativeBackButton(router) {
  if (!isNative()) return;

  const { App } = await import("@capacitor/app");

  App.addListener("backButton", () => {
    // Vuetify overlays close on Escape, and honour `persistent` by
    // ignoring it — which is exactly right here.
    const overlay = document.querySelector(".v-overlay--active");
    if (overlay) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      return;
    }

    const route = router.currentRoute.value;
    const atTop = route.name === "Home" || route.name === "Landing";

    if (atTop) {
      App.minimizeApp();
      return;
    }

    // history.state.back is null when this screen was opened directly —
    // from a notification or a fresh deep link — so there is nothing to
    // go back *to* and router.back() would silently do nothing, leaving
    // the button apparently broken.
    if (window.history.state?.back) router.back();
    else router.replace({ name: "Home" });
  });
}
