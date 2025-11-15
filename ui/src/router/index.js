/**
 * router/index.ts
 *
 * Automatic routes for `./src/pages/*.vue`
 */

// Composables
import { createRouter, createWebHistory } from "vue-router/auto";
import store from "../store";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/Landing",
      name: "Landing",
      component: () => import("../views/Landing.vue"),
    },
    {
      path: "/Home",
      name: "Home",
      component: () => import("../views/Home.vue"),
    },
    {
      path: "/Purchases",
      name: "Purchases",
      component: () => import("../components/Purchases.vue"),
      meta: { requiresAuth: true, task: "can_see_ingredients_stock" },
    },
    {
      path: "/Productions",
      name: "Productions",
      component: () => import("../components/Productions.vue"),
    },
    {
      path: "/StockTransfers",
      name: "StockTransfers",
      component: () => import("../components/StockTransfers.vue"),
    },
    {
      path: "/Sales",
      name: "Sales",
      component: () => import("../components/Sales.vue"),
    },
    {
      path: "/GiveOut",
      name: "GiveOut",
      component: () => import("../components/GiveOut.vue"),
    },
    {
      path: "/Expenditures",
      name: "Expenditures",
      component: () => import("../components/Expenditures.vue"),
    },
    {
      path: "/ProfitProjection",
      name: "ProfitProjection",
      component: () => import("../components/ProfitProjection.vue"),
    },
    {
      path: "/MarginDashboard",
      name: "MarginDashboard",
      component: () => import("../components/MarginDashboard.vue"),
    },
    {
      path: "/Staffs",
      name: "Staffs",
      component: () => import("../components/Staffs.vue"),
    },
    {
      path: "/Users",
      name: "Users",
      component: () => import("../components/Users.vue"),
    },
    {
      path: "/DatabaseSettings",
      name: "DatabaseSettings",
      component: () => import("../components/settings/DatabaseSettings.vue"),
    },
    {
      path: "/ReportsList",
      name: "ReportsList",
      component: () => import("../components/reports/ReportsList.vue"),
    },
    {
      path: "/Login",
      name: "Login",
      component: () => import("../components/Login.vue"),
    },
    {
      path: "/Logout",
      name: "Logout",
      component: () => import("../components/Logout.vue"),
    },
  ],
});

// Workaround for https://github.com/vitejs/vite/issues/11804
router.onError((err, to) => {
  if (err?.message?.includes?.("Failed to fetch dynamically imported module")) {
    if (!localStorage.getItem("vuetify:dynamic-reload")) {
      console.log("Reloading page to fix dynamic import error");
      localStorage.setItem("vuetify:dynamic-reload", "true");
      location.assign(to.fullPath);
    } else {
      console.error("Dynamic import error, reloading page did not fix it", err);
    }
  } else {
    console.error(err);
  }
});

router.isReady().then(() => {
  localStorage.removeItem("vuetify:dynamic-reload");
});

router.beforeEach((to, from, next) => {
  const token = store.state.auth.token;

  // Public routes
  if (!to.meta.requiresAuth) {
    return next();
  }

  // Not logged in
  if (!token) {
    return next("/Login");
  }

  // Route requires a task
  if (to.meta.task) {
    const hasPermission = store.getters.hasTask(to.meta.task);

    if (!hasPermission) {
      store.commit("setMessage", {
        type: "error",
        text: "You don't have permission to access this section.",
      });
      return next("/Home");
    }
  }

  // All good
  next();
});

export default router;
