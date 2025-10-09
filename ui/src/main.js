import App from './App.vue'
import store from './store';
import i18n, { setI18nLanguage } from './i18n'

import { createApp } from 'vue'

import { registerPlugins } from '@/plugins'

import IdleVue from 'idle-vue'

import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css'

const app = createApp(App)

app.use(store);
app.use(i18n)
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

const savedLocale = localStorage.getItem('user-locale') || 'en'
setI18nLanguage(savedLocale).finally(() => {
  app.mount('#app')
})
