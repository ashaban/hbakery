import { createRouter, createWebHashHistory } from "vue-router";
import { ensureSessionRestored, isSignedIn } from "@/lib/auth";

// Hash history, not web history: the Capacitor WebView loads the app
// from a file-backed origin with no server behind it, so a deep path
// like /orders on reload has nothing to serve it. A hash route never
// leaves index.html.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    // A record-level redirect is resolved during matching, before the
    // guard below has had a chance to restore the session — so it would
    // always decide "not signed in". Send everyone to /shop and let the
    // guard bounce them once it actually knows.
    { path: "/", redirect: "/shop" },
    {
      path: "/welcome",
      name: "Welcome",
      component: () => import("@/views/Welcome.vue"),
      meta: { public: true },
    },
    {
      path: "/sign-in",
      name: "SignIn",
      component: () => import("@/views/SignIn.vue"),
      meta: { public: true },
    },
    {
      path: "/register",
      name: "Register",
      component: () => import("@/views/Register.vue"),
      meta: { public: true },
    },
    {
      path: "/shop",
      name: "Shop",
      component: () => import("@/views/Shop.vue"),
    },
    {
      path: "/cart",
      name: "Cart",
      component: () => import("@/views/Cart.vue"),
    },
    {
      path: "/orders",
      name: "Orders",
      component: () => import("@/views/Orders.vue"),
    },
    {
      path: "/orders/:id",
      name: "OrderDetail",
      component: () => import("@/views/OrderDetail.vue"),
    },
    {
      path: "/account",
      name: "Account",
      component: () => import("@/views/Account.vue"),
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach(async to => {
  // Nothing may render — and so nothing may call the API — until the
  // stored token has been loaded and checked. Otherwise a cold start
  // requests data with no token, takes the 401, and signs the customer
  // out of a session that was fine.
  await ensureSessionRestored();

  const signedIn = isSignedIn();

  // A signed-in customer has no use for the welcome/sign-in screens.
  if (to.meta.public) {
    return signedIn ? { name: "Shop" } : true;
  }

  return signedIn ? true : { name: "Welcome" };
});

export default router;
