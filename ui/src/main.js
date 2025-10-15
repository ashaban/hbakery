import App from './App.vue'
import store from './store';

import { createApp } from 'vue'

import { registerPlugins } from '@/plugins'

import IdleVue from 'idle-vue'

import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css'

const app = createApp(App)

app.use(store);
app.component('VueDatePicker', VueDatePicker);

// Idle-Vue configuration (5 minutes inactivity)
const eventsHub = createApp();
app.use(IdleVue, {
  eventEmitter: eventsHub.config.globalProperties,
  idleTime: 300000, // 5 minutes in milliseconds
  store,
  startAtIdle: false,
  events: ['mousemove', 'keydown', 'wheel', 'scroll', 'mousedown', 'touchstart'],
});

registerPlugins(app)

app.mount('#app')