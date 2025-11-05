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
    :width="300"
  >
    <!-- Logo/Collapse Area -->
    <div class="brand-section">
      <v-list-item class="px-2 py-3 brand-item">
        <template #prepend>
          <v-avatar
            v-if="mini"
            class="brand-avatar-mini"
            color="primary"
            size="44"
            @click.stop="mini = !mini"
          >
            <v-icon color="white" icon="mdi-chevron-right" size="20" />
          </v-avatar>

          <div v-else class="brand-content">
            <div class="logo-container">
              <v-avatar class="brand-logo" color="primary" size="40">
                <v-icon color="white" icon="mdi-storefront" size="22" />
              </v-avatar>
              <div class="brand-text">
                <span class="text-h6 font-weight-bold text-primary"
                  >Hanein Bakery</span
                >
                <span class="text-caption text-grey">Admin Portal</span>
              </div>
            </div>
            <v-btn
              class="collapse-btn"
              icon
              size="small"
              variant="text"
              @click.stop="mini = !mini"
            >
              <v-icon color="primary" icon="mdi-chevron-left" size="20" />
            </v-btn>
          </div>
        </template>
      </v-list-item>
    </div>

    <v-divider class="menu-divider" />

    <!-- Main Menu -->
    <v-list class="px-3 py-2" density="comfortable" nav>
      <!-- Operations Section -->
      <div class="menu-section">
        <v-list-subheader
          v-if="!mini"
          class="text-uppercase font-weight-bold text-caption"
        >
          Operations
        </v-list-subheader>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="Purchases"
          value="Purchases"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="blue-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon
                color="blue-darken-2"
                icon="mdi-cart-arrow-down"
                size="20"
              />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Purchases</v-list-item-title
          >
        </v-list-item>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="Expenditures"
          value="Expenditures"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="orange-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon
                color="orange-darken-2"
                icon="mdi-cash-multiple"
                size="20"
              />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Expenditures</v-list-item-title
          >
        </v-list-item>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="Productions"
          value="Productions"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="green-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon color="green-darken-2" icon="mdi-factory" size="20" />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Productions</v-list-item-title
          >
        </v-list-item>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="Sales"
          value="Sales"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="green-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon color="green-darken-2" icon="mdi-factory" size="20" />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Sales</v-list-item-title
          >
        </v-list-item>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="StockTransfers"
          value="StockTransfers"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="green-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon color="green-darken-2" icon="mdi-factory" size="20" />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Stock Transfers</v-list-item-title
          >
        </v-list-item>
      </div>

      <!-- Analytics Section -->
      <div class="menu-section">
        <v-list-subheader
          v-if="!mini"
          class="text-uppercase font-weight-bold text-caption"
        >
          Analytics
        </v-list-subheader>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="ProfitProjection"
          value="ProfitProjection"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="purple-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon
                color="purple-darken-2"
                icon="mdi-trending-up"
                size="20"
              />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Profit Projection</v-list-item-title
          >
        </v-list-item>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="MarginDashboard"
          value="MarginDashboard"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="purple-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon
                color="purple-darken-2"
                icon="mdi-trending-up"
                size="20"
              />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Profit Dashboard</v-list-item-title
          >
        </v-list-item>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="ReportsList"
          value="reports"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="indigo-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon
                color="indigo-darken-2"
                icon="mdi-chart-areaspline"
                size="20"
              />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Reports</v-list-item-title
          >
          <template #append>
            <v-icon
              v-if="!mini"
              color="indigo"
              icon="mdi-star-circle"
              size="16"
            />
          </template>
        </v-list-item>
      </div>

      <!-- People Management -->
      <div class="menu-section">
        <v-list-subheader
          v-if="!mini"
          class="text-uppercase font-weight-bold text-caption"
        >
          People
        </v-list-subheader>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="Staffs"
          value="Staffs"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="teal-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon
                color="teal-darken-2"
                icon="mdi-account-multiple"
                size="20"
              />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Staffs</v-list-item-title
          >
        </v-list-item>

        <v-list-item
          active-class="menu-item--active"
          class="menu-item rounded-xl"
          to="Users"
          value="users"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="cyan-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon
                color="cyan-darken-2"
                icon="mdi-account-group"
                size="20"
              />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Users</v-list-item-title
          >
        </v-list-item>
      </div>

      <!-- Settings at Bottom -->
      <div class="menu-bottom">
        <v-list-item
          v-if="$store.state.auth.role === 'admin'"
          active-class="menu-item--active"
          class="menu-item rounded-xl settings-item"
          to="DatabaseSettings"
          value="settings"
        >
          <template #prepend>
            <v-avatar
              class="menu-avatar"
              color="grey-lighten-5"
              rounded="lg"
              size="42"
            >
              <v-icon color="grey-darken-2" icon="mdi-cog" size="20" />
            </v-avatar>
          </template>
          <v-list-item-title class="font-weight-medium menu-title"
            >Settings</v-list-item-title
          >
        </v-list-item>

        <!-- User Profile -->
        <div v-if="!mini" class="user-profile">
          <v-divider class="my-3" />
          <div class="profile-content">
            <v-avatar color="primary" size="36">
              <span class="text-white text-caption font-weight-bold">
                {{ userInitials }}
              </span>
            </v-avatar>
            <div class="profile-info">
              <div class="text-body-2 font-weight-medium">{{ userName }}</div>
              <div class="text-caption text-grey">{{ userRole }}</div>
            </div>
          </div>
        </div>
      </div>
    </v-list>
  </v-navigation-drawer>
</template>

<script>
export default {
  data() {
    return {
      mini: false,
      drawer: true,
      hasNewPurchases: false,
    };
  },
  computed: {
    userName() {
      return this.$store.state.auth?.user?.name || "Admin User";
    },
    userRole() {
      return this.$store.state.auth?.role || "admin";
    },
    userInitials() {
      return this.userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);
    },
  },
  methods: {
    toggleMini() {
      this.mini = !this.mini;
    },
  },
};
</script>

<style scoped>
.navigation-menu {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
  box-shadow:
    4px 0 20px rgba(0, 0, 0, 0.08),
    inset -1px 0 0 rgba(0, 0, 0, 0.05) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-right: none !important;
}

.brand-section {
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.brand-item {
  min-height: 72px !important;
}

.brand-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  box-shadow: 0 4px 12px rgba(86, 159, 211, 0.3);
  transition: all 0.3s ease;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-avatar-mini {
  box-shadow: 0 4px 12px rgba(86, 159, 211, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
}

.brand-avatar-mini:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(86, 159, 211, 0.4);
}

.collapse-btn {
  transition: all 0.3s ease;
}

.collapse-btn:hover {
  background-color: rgba(86, 159, 211, 0.1) !important;
  transform: rotate(-90deg);
}

.menu-divider {
  margin: 0 16px;
  border-color: rgba(0, 0, 0, 0.06) !important;
}

.menu-section {
  margin-bottom: 16px;
}

.menu-section:last-of-type {
  margin-bottom: 0;
}

.v-list-subheader {
  color: #64748b !important;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  padding-left: 0 !important;
  height: auto !important;
}

.menu-item {
  margin-bottom: 6px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  position: relative;
  overflow: hidden;
}

.menu-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 0;
  background: linear-gradient(135deg, #569fd3, #3b82f6);
  border-radius: 0 2px 2px 0;
  transition: height 0.3s ease;
}

.menu-item:hover {
  background: linear-gradient(
    135deg,
    rgba(86, 159, 211, 0.08),
    rgba(59, 130, 246, 0.05)
  ) !important;
  border-color: rgba(86, 159, 211, 0.2);
  transform: translateX(4px);
}

.menu-item:hover::before {
  height: 60%;
}

.menu-item--active {
  background: linear-gradient(
    135deg,
    rgba(86, 159, 211, 0.12),
    rgba(59, 130, 246, 0.08)
  ) !important;
  border-color: rgba(86, 159, 211, 0.3);
  box-shadow: 0 4px 12px rgba(86, 159, 211, 0.15);
}

.menu-item--active::before {
  height: 70%;
  background: linear-gradient(135deg, #569fd3, #3b82f6);
}

.menu-avatar {
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.menu-item:hover .menu-avatar {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.menu-title {
  color: #334155;
  font-size: 0.875rem;
  transition: color 0.3s ease;
}

.menu-item:hover .menu-title {
  color: #1e293b;
}

.menu-item--active .menu-title {
  color: #1e40af;
  font-weight: 600;
}

.menu-badge {
  font-size: 0.7rem;
  font-weight: 600;
  min-width: 20px;
  height: 20px;
}

.menu-bottom {
  margin-top: auto;
  padding-top: 16px;
}

.settings-item {
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.user-profile {
  padding: 8px 0;
}

.profile-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
  transition: all 0.3s ease;
}

.profile-content:hover {
  background: rgba(0, 0, 0, 0.04);
}

.profile-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

/* Mini state styles */
.v-navigation-drawer--rail .menu-section {
  margin-bottom: 8px;
}

.v-navigation-drawer--rail .menu-item {
  justify-content: center;
  padding: 0;
  margin-bottom: 4px;
}

.v-navigation-drawer--rail .menu-item__prepend {
  margin-right: 0;
}

.v-navigation-drawer--rail .menu-item__content {
  display: none;
}

.v-navigation-drawer--rail .brand-section {
  padding: 16px 0;
}

/* Animation for menu items */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.menu-item {
  animation: slideIn 0.3s ease-out;
}

.menu-item:nth-child(1) {
  animation-delay: 0.05s;
}
.menu-item:nth-child(2) {
  animation-delay: 0.1s;
}
.menu-item:nth-child(3) {
  animation-delay: 0.15s;
}
.menu-item:nth-child(4) {
  animation-delay: 0.2s;
}
.menu-item:nth-child(5) {
  animation-delay: 0.25s;
}
</style>
