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
    // The site root has no screen of its own. It used to reach Landing
    // only as a side effect of App.vue bouncing every unauthenticated
    // visitor there; now that the bounce is limited to pages that
    // actually require a login, "/" needs a route of its own or it
    // renders nothing at all.
    { path: "/", redirect: "/Landing" },
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
      path: "/ProductionPlan",
      name: "ProductionPlan",
      component: () => import("../components/ProductionPlan.vue"),
      meta: { requiresAuth: true, task: "can_see_production_plans" },
    },
    {
      path: "/StockTransfers",
      name: "StockTransfers",
      component: () => import("../components/StockTransfers.vue"),
    },
    {
      path: "/TransferIntegrityCheck",
      name: "TransferIntegrityCheck",
      component: () => import("../components/TransferIntegrityCheck.vue"),
      meta: { requiresAuth: true, task: "can_transfer_stock" },
    },
    {
      path: "/DebtorsReport",
      name: "DebtorsReport",
      component: () => import("../components/DebtorsReport.vue"),
      meta: { requiresAuth: true, task: "can_see_debtors_report" },
    },
    {
      path: "/Sales",
      name: "Sales",
      component: () => import("../components/Sales.vue"),
      meta: { requiresAuth: true, task: "can_see_sales" },
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
      path: "/Loans",
      name: "Loans",
      component: () => import("../components/Loans.vue"),
      meta: { requiresAuth: true, task: "can_see_loans" },
    },
    {
      path: "/Payables",
      name: "Payables",
      component: () => import("../components/Payables.vue"),
      meta: { requiresAuth: true, task: "can_see_payables" },
    },
    {
      path: "/Payroll",
      name: "Payroll",
      component: () => import("../components/Payroll.vue"),
      meta: { requiresAuth: true, task: "can_see_payroll" },
    },
    {
      path: "/Orders",
      name: "Orders",
      component: () => import("../components/Orders.vue"),
      meta: { requiresAuth: true, task: "can_see_orders" },
    },
    {
      path: "/Boards",
      name: "BoardsList",
      component: () => import("../components/BoardsList.vue"),
      meta: { requiresAuth: true, task: "can_use_boards" },
    },
    {
      path: "/Board",
      name: "Board",
      component: () => import("../components/Board.vue"),
      meta: { requiresAuth: true, task: "can_use_boards" },
    },
    {
      // Public — no login. Someone filling in an intake form ("report a
      // maintenance issue") may have no ITSF-style account at all.
      path: "/BoardForm",
      name: "BoardForm",
      component: () => import("../views/BoardForm.vue"),
    },
    {
      path: "/Users",
      name: "Users",
      component: () => import("../components/Users.vue"),
      meta: { requiresAuth: true, task: "can_see_users" },
    },
    {
      path: "/DatabaseSettings",
      name: "DatabaseSettings",
      component: () => import("../components/settings/DatabaseSettings.vue"),
      meta: { requiresAuth: true, task: "can_see_settings" },
    },
    {
      path: "/ReportsList",
      name: "ReportsList",
      component: () => import("../components/reports/ReportsList.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/AuditLog",
      name: "AuditLog",
      component: () => import("../components/reports/AuditLog.vue"),
      meta: { requiresAuth: true, task: "can_see_audit_log" },
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
