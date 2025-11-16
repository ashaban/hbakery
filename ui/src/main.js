import App from "./App.vue";
import store from "./store";

import { createApp } from "vue";

import { registerPlugins } from "@/plugins";

import VueDatePicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

const app = createApp(App);

app.use(store);
app.component("VueDatePicker", VueDatePicker);

registerPlugins(app);

app.mount("#app");
