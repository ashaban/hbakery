<template>
  <v-app>
    <!-- Splash while the stored token is checked, so a returning
         customer never sees the sign-in screen flash past. -->
    <v-main v-if="!session.ready">
      <div class="d-flex flex-column align-center justify-center fill-height">
        <v-avatar color="primary" size="72">
          <v-icon color="white" size="40">mdi-bread-slice</v-icon>
        </v-avatar>
        <div class="text-h6 mt-4">{{ $t("app.name") }}</div>
        <v-progress-circular class="mt-6" color="primary" indeterminate />
      </div>
    </v-main>

    <template v-else>
      <v-main class="app-main">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </v-main>

      <v-bottom-navigation
        v-if="showNav"
        v-model="activeTab"
        class="app-bottom-nav"
        color="primary"
        grow
      >
        <v-btn value="shop" @click="go('/shop')">
          <v-icon>mdi-storefront</v-icon>
          <span>{{ $t("nav.shop") }}</span>
        </v-btn>

        <v-btn value="cart" @click="go('/cart')">
          <v-badge
            v-if="cartCount > 0"
            color="error"
            :content="cartCount"
            offset-x="-4"
            offset-y="4"
          >
            <v-icon>mdi-cart</v-icon>
          </v-badge>
          <v-icon v-else>mdi-cart-outline</v-icon>
          <span>{{ $t("nav.cart") }}</span>
        </v-btn>

        <v-btn value="orders" @click="go('/orders')">
          <v-icon>mdi-clipboard-list-outline</v-icon>
          <span>{{ $t("nav.orders") }}</span>
        </v-btn>

        <v-btn value="account" @click="go('/account')">
          <v-icon>mdi-account-outline</v-icon>
          <span>{{ $t("nav.account") }}</span>
        </v-btn>
      </v-bottom-navigation>
    </template>

    <v-snackbar
      v-model="toast.active"
      :color="toast.color"
      location="top"
      :timeout="3500"
    >
      {{ toast.text }}
    </v-snackbar>
  </v-app>
</template>

<script setup>
  import { computed, ref, watch } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { session } from "@/lib/auth";
  import { cartCount } from "@/lib/cart";
  import { toast } from "@/lib/toast";

  const route = useRoute();
  const router = useRouter();

  const activeTab = ref("shop");

  // The tab bar is for signed-in customers only — it would be dead
  // weight on the welcome/sign-in/register screens.
  const showNav = computed(
    () => !route.meta.public && Boolean(session.customer),
  );

  // Keep the highlighted tab in step with wherever the router actually
  // is, including back-button navigation the tab bar didn't cause.
  watch(
    () => route.path,
    path => {
      if (path.startsWith("/shop")) activeTab.value = "shop";
      else if (path.startsWith("/cart")) activeTab.value = "cart";
      else if (path.startsWith("/orders")) activeTab.value = "orders";
      else if (path.startsWith("/account")) activeTab.value = "account";
    },
    { immediate: true },
  );

  function go (path) {
    if (route.path !== path) router.push(path);
  }
</script>

<style>
/* Every screen's <v-app-bar> is fixed to the very top of the viewport,
   so on Android 15+ (which enforces edge-to-edge drawing and can no
   longer be opted out of) it sits directly under the status bar — the
   title/icons render behind the clock, battery icon and notch.
   env(safe-area-inset-top) is the correct, OS-supplied height of that
   area, not a fixed pixel guess.

   Two separate pieces are needed together, not one or the other:

   1. The app-bar itself needs to grow taller by that inset and pad its
      *content* down by the same amount, so its coloured background
      extends up under the status bar (matching it visually) while the
      title/icons sit below it, clear of the overlap.

   2. Vuetify reserves space for page content based on each app-bar's
      `height` PROP (a static 64, computed once — not the actual
      rendered DOM size), so it has no way to know we just made the bar
      taller. Without also pushing .app-main down by the same inset,
      page content would start where Vuetify still thinks the (shorter)
      bar ends, hiding behind the extra height added in step 1.

      That compensation has to be a MARGIN, not padding: Vuetify sets
      v-main's own reserved-space padding-top as an inline style, which
      always wins over a plain class rule for the same property — margin
      is a different property, so it stacks on top instead of losing a
      specificity fight. */
.v-toolbar.v-app-bar {
  /* 64px is Vuetify's own VToolbar default height (no `density` prop is
     set on any of our app-bars, so this always applies). */
  height: calc(64px + env(safe-area-inset-top)) !important;
  padding-top: env(safe-area-inset-top);
}

.app-main {
  margin-top: env(safe-area-inset-top);
}

.app-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
  height: auto !important;
}
</style>
