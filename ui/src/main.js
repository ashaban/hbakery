import App from "./App.vue";
import store from "./store";
import router from "./router";

import { createApp } from "vue";

import { registerPlugins } from "@/plugins";
import { isNative } from "@/lib/platform";
import { attachNativeBackButton } from "@/lib/nativeBack";

const app = createApp(App);

app.use(store);

registerPlugins(app);

// Android's back button: close a dialog, else go back, else minimise —
// rather than the WebView default, which does nothing once there's no
// page history left, leaving the app stuck at the top.
attachNativeBackButton(router);

if (isNative()) {
  // Match the status bar to the app's own primary colour instead of the
  // WebView's default white/black — otherwise the very top of the screen
  // looks like a different, unstyled app.
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => {
      StatusBar.setBackgroundColor({ color: "#1867C0" });
      // Style.Dark = light (white) status bar text/icons — correct for
      // this dark-blue background, despite the confusing name.
      StatusBar.setStyle({ style: Style.Dark });
    })
    .catch(() => {
      /* Not fatal — the WebView's default status bar still works. */
    });
}

app.mount("#app");
