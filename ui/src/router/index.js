/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue`
 */

// Composables
import { createRouter, createWebHistory } from 'vue-router/auto'
import store from '../store'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{
    path: '/Landing',
    name: 'Landing',
    component: () => import('../views/Landing.vue'),
  }, {
    path: '/Purchases',
    name: 'Purchases',
    component: () => import('../components/Purchases.vue'),
  }, {
    path: '/Productions',
    name: 'Productions',
    component: () => import('../components/Productions.vue'),
  }, {
    path: '/ProfitProjection',
    name: 'ProfitProjection',
    component: () => import('../components/ProfitProjection.vue'),
  }, {
    path: '/Staffs',
    name: 'Staffs',
    component: () => import('../components/Staffs.vue'),
  }, {
    path: '/Users',
    name: 'Users',
    component: () => import('../components/Users.vue'),
  }, {
    path: '/DatabaseSettings',
    name: 'DatabaseSettings',
    component: () => import('../components/settings/DatabaseSettings.vue'),
    beforeEnter: (to, from, next) => {
      if(store.state.auth.role === 'admin') {
        return next()
      }
      next({ path: from.path })
    },
  }, {
    path: '/Login',
    name: 'Login',
    component: () => import('../components/Login.vue'),
  }, {
    path: '/Logout',
    name: 'Logout',
    component: () => import('../components/Logout.vue'),
  }],
})

// Workaround for https://github.com/vitejs/vite/issues/11804
router.onError((err, to) => {
  if (err?.message?.includes?.('Failed to fetch dynamically imported module')) {
    if (!localStorage.getItem('vuetify:dynamic-reload')) {
      console.log('Reloading page to fix dynamic import error')
      localStorage.setItem('vuetify:dynamic-reload', 'true')
      location.assign(to.fullPath)
    } else {
      console.error('Dynamic import error, reloading page did not fix it', err)
    }
  } else {
    console.error(err)
  }
})

router.isReady().then(() => {
  localStorage.removeItem('vuetify:dynamic-reload')
})

export default router
