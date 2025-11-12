<template>
  <v-container class="home-apps" fluid>
    <!-- Header Section -->
    <v-card class="home-header mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="header-content">
          <div class="welcome-section">
            <v-avatar class="app-logo" color="primary" size="60">
              <v-icon
                color="white"
                icon="mdi-silverware-fork-knife"
                size="28"
              />
            </v-avatar>
            <div class="welcome-text">
              <h1 class="text-h4 font-weight-bold text-primary">
                Welcome to Hanein
              </h1>
              <p class="text-body-1 text-grey">Bakery Management Suite</p>
            </div>
          </div>
          <div class="quick-stats">
            <v-chip class="stat-chip" color="primary" variant="tonal">
              <v-icon start>mdi-calendar-today</v-icon>
              {{ currentDate }}
            </v-chip>
            <v-chip class="stat-chip" color="green" variant="tonal">
              <v-icon start>mdi-account</v-icon>
              {{ userName }}
            </v-chip>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Apps Grid Section -->
    <div class="apps-container">
      <!-- Operations Apps -->
      <v-card class="app-category-card mb-6" elevation="1" rounded="lg">
        <v-card-text class="pa-4">
          <div class="category-header">
            <v-avatar class="mr-3" color="blue-lighten-5" size="40">
              <v-icon color="blue-darken-2" icon="mdi-cog" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold">Operations</h2>
              <p class="text-caption text-grey">Daily business operations</p>
            </div>
          </div>

          <v-divider class="my-4" />

          <div class="apps-grid">
            <v-card
              v-for="app in operationsApps"
              :key="app.id"
              :class="['app-card', { active: $route.name === app.route }]"
              elevation="1"
              @click="$router.push(app.route)"
            >
              <div class="app-icon-wrapper">
                <v-avatar
                  class="app-icon"
                  :color="app.color"
                  rounded="lg"
                  size="56"
                >
                  <v-icon :color="app.iconColor" :icon="app.icon" size="26" />
                </v-avatar>
                <v-badge
                  v-if="app.notifications"
                  class="notification-badge"
                  color="red"
                  :content="app.notifications"
                />
              </div>
              <div class="app-name">{{ app.name }}</div>
              <div class="app-description">{{ app.description }}</div>
            </v-card>
          </div>
        </v-card-text>
      </v-card>

      <!-- Analytics Apps -->
      <v-card class="app-category-card mb-6" elevation="1" rounded="lg">
        <v-card-text class="pa-4">
          <div class="category-header">
            <v-avatar class="mr-3" color="purple-lighten-5" size="40">
              <v-icon color="purple-darken-2" icon="mdi-chart-bar" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold">Analytics</h2>
              <p class="text-caption text-grey">Reports and insights</p>
            </div>
          </div>

          <v-divider class="my-4" />

          <div class="apps-grid">
            <v-card
              v-for="app in analyticsApps"
              :key="app.id"
              :class="['app-card', { active: $route.name === app.route }]"
              elevation="1"
              @click="$router.push(app.route)"
            >
              <div class="app-icon-wrapper">
                <v-avatar
                  class="app-icon"
                  :color="app.color"
                  rounded="lg"
                  size="56"
                >
                  <v-icon :color="app.iconColor" :icon="app.icon" size="26" />
                </v-avatar>
                <v-icon
                  v-if="app.featured"
                  class="featured-badge"
                  color="amber"
                  icon="mdi-star"
                  size="18"
                />
              </div>
              <div class="app-name">{{ app.name }}</div>
              <div class="app-description">{{ app.description }}</div>
            </v-card>
          </div>
        </v-card-text>
      </v-card>

      <!-- People Apps -->
      <v-card class="app-category-card mb-6" elevation="1" rounded="lg">
        <v-card-text class="pa-4">
          <div class="category-header">
            <v-avatar class="mr-3" color="green-lighten-5" size="40">
              <v-icon color="green-darken-2" icon="mdi-account-group" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold">People</h2>
              <p class="text-caption text-grey">Team and user management</p>
            </div>
          </div>

          <v-divider class="my-4" />

          <div class="apps-grid">
            <v-card
              v-for="app in peopleApps"
              :key="app.id"
              :class="['app-card', { active: $route.name === app.route }]"
              elevation="1"
              @click="$router.push(app.route)"
            >
              <div class="app-icon-wrapper">
                <v-avatar
                  class="app-icon"
                  :color="app.color"
                  rounded="lg"
                  size="56"
                >
                  <v-icon :color="app.iconColor" :icon="app.icon" size="26" />
                </v-avatar>
              </div>
              <div class="app-name">{{ app.name }}</div>
              <div class="app-description">{{ app.description }}</div>
            </v-card>
          </div>
        </v-card-text>
      </v-card>

      <!-- System Apps -->
      <v-card
        v-if="$store.state.auth.role === 'admin'"
        class="app-category-card mb-6"
        elevation="1"
        rounded="lg"
      >
        <v-card-text class="pa-4">
          <div class="category-header">
            <v-avatar class="mr-3" color="grey-lighten-5" size="40">
              <v-icon color="grey-darken-2" icon="mdi-cog" />
            </v-avatar>
            <div>
              <h2 class="text-h6 font-weight-bold">System</h2>
              <p class="text-caption text-grey">Administration settings</p>
            </div>
          </div>

          <v-divider class="my-4" />

          <div class="apps-grid">
            <v-card
              class="app-card"
              :class="{ active: $route.name === 'DatabaseSettings' }"
              elevation="1"
              @click="$router.push('DatabaseSettings')"
            >
              <div class="app-icon-wrapper">
                <v-avatar
                  class="app-icon"
                  color="grey-lighten-5"
                  rounded="lg"
                  size="56"
                >
                  <v-icon
                    color="grey-darken-2"
                    icon="mdi-database-cog"
                    size="26"
                  />
                </v-avatar>
              </div>
              <div class="app-name">Settings</div>
              <div class="app-description">System configuration</div>
            </v-card>
          </div>
        </v-card-text>
      </v-card>
    </div>
  </v-container>
</template>

<script>
export default {
  name: "HomePage",
  data() {
    return {
      operationsApps: [
        {
          id: 1,
          name: "Purchases",
          route: "Purchases",
          icon: "mdi-cart-arrow-down",
          color: "blue-lighten-5",
          iconColor: "blue-darken-2",
          description: "Manage inventory purchases",
        },
        {
          id: 2,
          name: "Expenses",
          route: "Expenditures",
          icon: "mdi-credit-card-outline",
          color: "orange-lighten-5",
          iconColor: "orange-darken-2",
          description: "Track business expenses",
        },
        {
          id: 3,
          name: "Production",
          route: "Productions",
          icon: "mdi-cookie-outline",
          color: "green-lighten-5",
          iconColor: "green-darken-2",
          description: "Manage production batches",
        },
        {
          id: 4,
          name: "Sales",
          route: "Sales",
          icon: "mdi-point-of-sale",
          color: "teal-lighten-5",
          iconColor: "teal-darken-2",
          description: "Sales and point of sale",
        },
        {
          id: 5,
          name: "Give Out",
          route: "GiveOut",
          icon: "mdi-archive-arrow-up",
          color: "deep-orange-lighten-5",
          iconColor: "deep-orange-darken-2",
          description: "Product distribution",
        },
        {
          id: 6,
          name: "Transfers",
          route: "StockTransfers",
          icon: "mdi-package-variant",
          color: "deep-purple-lighten-5",
          iconColor: "deep-purple-darken-2",
          description: "Stock transfers between outlets",
        },
      ],
      analyticsApps: [
        {
          id: 7,
          name: "Profit Pro",
          route: "ProfitProjection",
          icon: "mdi-chart-line",
          color: "amber-lighten-5",
          iconColor: "amber-darken-2",
          description: "Profit projections and forecasts",
          featured: true,
        },
        {
          id: 8,
          name: "Dashboard",
          route: "MarginDashboard",
          icon: "mdi-finance",
          color: "purple-lighten-5",
          iconColor: "purple-darken-2",
          description: "Business performance dashboard",
        },
        {
          id: 9,
          name: "Reports",
          route: "ReportsList",
          icon: "mdi-chart-box",
          color: "indigo-lighten-5",
          iconColor: "indigo-darken-2",
          description: "Comprehensive reports",
          featured: true,
        },
      ],
      peopleApps: [
        {
          id: 10,
          name: "Staff",
          route: "Staffs",
          icon: "mdi-chef-hat",
          color: "cyan-lighten-5",
          iconColor: "cyan-darken-2",
          description: "Staff management",
        },
        {
          id: 11,
          name: "Users",
          route: "Users",
          icon: "mdi-account-cog",
          color: "light-blue-lighten-5",
          iconColor: "light-blue-darken-2",
          description: "User accounts and permissions",
        },
      ],
    };
  },
  computed: {
    userName() {
      return this.$store.state.auth?.user?.name || "Admin User";
    },
    userRole() {
      return this.$store.state.auth?.role || "admin";
    },
    currentDate() {
      return new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    },
  },
};
</script>

<style scoped>
.home-apps {
  max-width: 1400px;
  margin: 0 auto;
}

.home-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.home-header :deep(.v-card-text) {
  color: white;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.welcome-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-logo {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.welcome-text h1 {
  color: white !important;
  margin-bottom: 4px;
}

.welcome-text p {
  color: rgba(255, 255, 255, 0.9) !important;
  margin: 0;
}

.quick-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-chip {
  background: rgba(255, 255, 255, 0.2) !important;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.apps-container {
  max-width: 1200px;
  margin: 0 auto;
}

.app-category-card {
  transition: all 0.3s ease;
}

.app-category-card:hover {
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1) !important;
}

.category-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.app-card {
  border-radius: 16px !important;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 2px solid transparent;
  background: white !important;
  padding: 20px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
}

.app-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15) !important;
  border-color: rgba(86, 159, 211, 0.3);
}

.app-card.active {
  border-color: #569fd3;
  background: linear-gradient(
    135deg,
    rgba(86, 159, 211, 0.08),
    rgba(59, 130, 246, 0.05)
  ) !important;
}

.app-icon-wrapper {
  position: relative;
  margin-bottom: 12px;
}

.app-icon {
  transition: all 0.3s ease;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}

.app-card:hover .app-icon {
  transform: scale(1.15);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.18);
}

.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
}

.featured-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: white;
  border-radius: 50%;
  padding: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.app-name {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
  line-height: 1.2;
  margin-bottom: 4px;
}

.app-description {
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.3;
}

.app-card:hover .app-name {
  color: #1e293b;
}

.app-card.active .app-name {
  color: #1e40af;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e40af;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
}

/* Animation for app cards */
@keyframes appSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-card {
  animation: appSlideIn 0.5s ease-out;
}

.app-card:nth-child(1) {
  animation-delay: 0.05s;
}
.app-card:nth-child(2) {
  animation-delay: 0.1s;
}
.app-card:nth-child(3) {
  animation-delay: 0.15s;
}
.app-card:nth-child(4) {
  animation-delay: 0.2s;
}
.app-card:nth-child(5) {
  animation-delay: 0.25s;
}
.app-card:nth-child(6) {
  animation-delay: 0.3s;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start;
  }

  .apps-grid {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }
}

@media (max-width: 600px) {
  .apps-grid {
    grid-template-columns: 1fr;
  }

  .welcome-section {
    flex-direction: column;
    text-align: center;
  }

  .app-card {
    min-height: 120px;
    padding: 16px;
  }
}
</style>
