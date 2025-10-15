<template>
  <v-navigation-drawer
    v-if="!$store.state.denyAccess"
    v-model="drawer"
    class="navigation-menu"
    :color="mini ? 'surface' : 'surface'"
    floating
    permanent
    :rail="mini"
    rail-width="72"
    style="z-index: 3"
    :width="280"
  >
    <!-- Logo/Collapse Area -->
    <v-list-item class="px-2 py-2">
      <template #prepend>
        <v-avatar
          v-if="mini"
          color="primary"
          size="40"
          @click.stop="mini=!mini"
        >
          <v-icon color="white" icon="mdi-chevron-right" />
        </v-avatar>
      </template>

      <v-list-item-title v-if="!mini" class="d-flex align-center">
        <span class="text-h6 font-weight-bold">Admin Portal</span>
        <v-spacer />
        <v-btn
          icon
          size="small"
          variant="text"
          @click.stop="mini=!mini"
        >
          <v-icon color="primary" icon="mdi-chevron-left" />
        </v-btn>
      </v-list-item-title>
    </v-list-item>

    <v-divider class="my-1" />

    <!-- Main Menu -->
    <v-list
      class="px-2"
      density="comfortable"
      nav
      :opened="open"
    >

      <!-- Users & Reports -->
      <v-list-item
        class="rounded-lg"
        to="Purchases"
        value="Purchases"
      >
        <template #prepend>
          <v-avatar
            color="purple-lighten-5"
            rounded="lg"
            size="40"
          >
            <v-icon color="purple-darken-2" icon="mdi-cash-multiple" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-medium">Purchases</v-list-item-title>
      </v-list-item>
      <v-list-item
        class="rounded-lg"
        to="Productions"
        value="Productions"
      >
        <template #prepend>
          <v-avatar
            color="purple-lighten-5"
            rounded="lg"
            size="40"
          >
            <v-icon color="purple-darken-2" icon="mdi-animation" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-medium">Productions</v-list-item-title>
      </v-list-item>
      <v-list-item
        class="rounded-lg"
        to="ProfitProjection"
        value="ProfitProjection"
      >
        <template #prepend>
          <v-avatar
            color="purple-lighten-5"
            rounded="lg"
            size="40"
          >
            <v-icon color="purple-darken-2" icon="mdi-animation" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-medium">Profit Projection</v-list-item-title>
      </v-list-item>
      <v-list-item
        class="rounded-lg"
        to="Staffs"
        value="Staffs"
      >
        <template #prepend>
          <v-avatar
            color="purple-lighten-5"
            rounded="lg"
            size="40"
          >
            <v-icon color="purple-darken-2" icon="mdi-account-multiple" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-medium">Staffs</v-list-item-title>
      </v-list-item>
      <v-list-item
        class="rounded-lg"
        to="Users"
        value="users"
      >
        <template #prepend>
          <v-avatar
            color="purple-lighten-5"
            rounded="lg"
            size="40"
          >
            <v-icon color="purple-darken-2" icon="mdi-account-group" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-medium">Users</v-list-item-title>
      </v-list-item>

      <v-list-item
        class="rounded-lg"
        to="ReportsBase"
        value="reports"
      >
        <template #prepend>
          <v-avatar
            color="orange-lighten-5"
            rounded="lg"
            size="40"
          >
            <v-icon color="orange-darken-2" icon="mdi-chart-areaspline" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-medium">Reports</v-list-item-title>
      </v-list-item>

      <!-- Settings at Bottom -->
      <v-list-item
        v-if="$store.state.auth.role === 'admin'"
        class="rounded-lg mt-auto"
        to="DatabaseSettings"
        value="settings"
      >
        <template #prepend>
          <v-avatar
            color="grey-lighten-5"
            rounded="lg"
            size="40"
          >
            <v-icon color="grey-darken-2" icon="mdi-cog" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-weight-medium">Settings</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script>
  export default {
    data () {
      return {
        mini: false,
        drawer: true,
        open: ['projects'], // Default open group
      };
    },
  };
</script>

<style scoped>
.navigation-menu {
  background: linear-gradient(to bottom, #ffffff, #f5f9ff) !important;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.08) !important;
  transition: all 0.3s ease;
}

.v-list-item {
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.v-list-item:hover {
  background-color: rgba(86, 159, 211, 0.1) !important;
}

.v-list-item--active {
  background-color: rgba(86, 159, 211, 0.15) !important;
  border-left: 3px solid #569fd3;
}

.v-list-group__items .v-list-item {
  margin-left: 12px;
  padding-left: 12px;
}

.v-avatar {
  transition: all 0.3s ease;
}

.v-navigation-drawer--rail .v-list-item {
  padding-left: 0;
  justify-content: center;
}

.v-navigation-drawer--rail .v-list-item__prepend {
  margin-right: 0;
}

.v-navigation-drawer--rail .v-list-item__content {
  display: none;
}
</style>
