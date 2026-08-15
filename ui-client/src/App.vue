<template>
  <v-app>
    <!-- Splash while the stored token is checked, so a returning
         customer never sees the sign-in screen flash past. -->
    <v-main v-if="!session.ready">
      <div class="d-flex flex-column align-center justify-center fill-height">
        <v-avatar color="primary" size="72">
          <v-icon color="white" size="40">mdi-silverware-fork-knife</v-icon>
        </v-avatar>
        <div class="text-h6 mt-4">Hanein Bakery</div>
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
          <span>Shop</span>
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
          <span>Cart</span>
        </v-btn>

        <v-btn value="orders" @click="go('/orders')">
          <v-icon>mdi-clipboard-list-outline</v-icon>
          <span>Orders</span>
        </v-btn>

        <v-btn value="account" @click="go('/account')">
          <v-icon>mdi-account-outline</v-icon>
          <span>Account</span>
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
/* Keep content clear of the status bar and the gesture/nav bar. */
.app-main {
  padding-top: env(safe-area-inset-top);
}

.app-bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
  height: auto !important;
}
</style>
