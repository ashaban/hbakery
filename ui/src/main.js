import App from "./App.vue";
import store from "./store";

import { createApp } from "vue";

import { registerPlugins } from "@/plugins";

const app = createApp(App);

app.use(store);

registerPlugins(app);

app.mount("#app");
