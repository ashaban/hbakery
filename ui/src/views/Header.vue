<template>
  <v-app-bar app clipped-left clipped-right color="#18794f">
    <v-app-bar-nav-icon class="ml-2">
      <img height="40" src="/mkate.jpeg" width="40">
    </v-app-bar-nav-icon>

    <v-app-bar-title class="text-center text-yellow font-weight-bold">
      <!-- Hanein Investment | Bakery Management System -->
    </v-app-bar-title>

    <v-spacer />

    <div class="d-flex align-center">
      <v-btn
        class="mr-2"
        color="red"
        dark
        icon
        title="Help"
      >
        <v-icon>mdi-bell-badge-outline</v-icon>
      </v-btn>

      <div class="text-yellow font-weight-bold mr-2">
        {{ $store.state.auth.name }}
      </div>

      <v-btn
        color="white"
        dark
        icon
        title="Logout"
        @click="$router.push('/Logout')"
      >
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </div>
  </v-app-bar>
</template>

<script setup>

</script>

<style scoped>
.v-app-bar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: fit-content;
}

.v-btn {
  min-width: 0 !important;
}
</style>
