<template>
  <v-container class="reports-dashboard" fluid>
    <!-- List View -->
    <div v-if="!activeReport" class="pt-6">
      <!-- Header Section -->
      <v-row class="mb-6">
        <v-col cols="12" md="8">
          <div class="d-flex align-center">
            <v-avatar class="mr-4" color="primary" size="56" variant="tonal">
              <v-icon color="primary" size="28">mdi-file-chart</v-icon>
            </v-avatar>
            <div>
              <h1 class="text-h4 font-weight-bold text-primary">
                Reports Dashboard
              </h1>
              <p class="text-body-1 text-grey-darken-1 mt-1">
                Access all analytical reports and insights in one place
              </p>
            </div>
          </div>
        </v-col>
        <v-col class="d-flex align-center justify-end" cols="12" md="4">
          <v-text-field
            v-model="search"
            class="search-field"
            clearable
            density="comfortable"
            hide-details
            placeholder="Search reports..."
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
          />
        </v-col>
      </v-row>

      <!-- Stats Overview -->
      <v-row class="mb-6">
        <v-col cols="12" md="3" sm="6">
          <v-card class="stat-card" color="blue-lighten-5" elevation="2">
            <v-card-text class="d-flex align-center">
              <v-avatar class="mr-3" color="blue" size="48" variant="tonal">
                <v-icon color="blue">mdi-file-document</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-blue">
                  {{ totalReports }}
                </div>
                <div class="text-caption text-grey">Total Reports</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card class="stat-card" color="green-lighten-5" elevation="2">
            <v-card-text class="d-flex align-center">
              <v-avatar class="mr-3" color="green" size="48" variant="tonal">
                <v-icon color="green">mdi-chart-bar</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-green">
                  {{ analyticsReports }}
                </div>
                <div class="text-caption text-grey">Analytics</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card class="stat-card" color="orange-lighten-5" elevation="2">
            <v-card-text class="d-flex align-center">
              <v-avatar class="mr-3" color="orange" size="48" variant="tonal">
                <v-icon color="orange">mdi-finance</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-orange">
                  {{ financialReports }}
                </div>
                <div class="text-caption text-grey">Financial</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card class="stat-card" color="purple-lighten-5" elevation="2">
            <v-card-text class="d-flex align-center">
              <v-avatar class="mr-3" color="purple" size="48" variant="tonal">
                <v-icon color="purple">mdi-package-variant</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-purple">
                  {{ inventoryReports }}
                </div>
                <div class="text-caption text-grey">Inventory</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Category Filters -->
      <v-row class="mb-4">
        <v-col cols="12">
          <div class="d-flex flex-wrap gap-2">
            <v-chip
              v-for="category in categories"
              :key="category"
              class="category-chip"
              :color="selectedCategory === category ? 'primary' : 'default'"
              :variant="selectedCategory === category ? 'flat' : 'outlined'"
              @click="toggleCategory(category)"
            >
              <v-icon :icon="getCategoryIcon(category)" size="18" start />
              {{ category }}
              <v-badge
                v-if="getCategoryCount(category) > 0"
                class="ml-2"
                :content="getCategoryCount(category)"
                inline
              />
            </v-chip>
          </div>
        </v-col>
      </v-row>

      <!-- Reports Grid -->
      <v-row>
        <v-col
          v-for="(report, index) in filteredReports"
          :key="index"
          cols="12"
          lg="3"
          md="4"
          sm="6"
        >
          <v-card
            class="report-card hoverable transition-smooth"
            elevation="4"
            @click="openReport(report)"
          >
            <v-card-title class="d-flex align-center pb-2">
              <v-avatar
                class="mr-3"
                :color="getCategoryColor(report.category)"
                size="48"
                variant="tonal"
              >
                <v-icon :color="getCategoryColor(report.category)" size="24">
                  {{ report.icon }}
                </v-icon>
              </v-avatar>
              <div class="flex-grow-1">
                <span class="text-h6 font-weight-bold line-clamp-1">{{
                  report.title
                }}</span>
                <v-chip
                  class="mt-1"
                  :color="getCategoryColor(report.category)"
                  size="x-small"
                  variant="flat"
                >
                  {{ report.category }}
                </v-chip>
              </div>
            </v-card-title>

            <v-card-text class="text-body-2 text-grey-darken-1 pt-2 pb-3">
              <div class="line-clamp-2 mb-3">{{ report.description }}</div>

              <!-- Report Metadata -->
              <div class="report-meta">
                <div class="d-flex align-center text-caption text-grey mb-1">
                  <v-icon class="mr-1" size="16">mdi-clock-outline</v-icon>
                  <span>{{ report.frequency }}</span>
                </div>
                <div class="d-flex align-center text-caption text-grey">
                  <v-icon class="mr-1" size="16">mdi-file-outline</v-icon>
                  <span class="text-uppercase">{{ report.format }}</span>
                </div>
              </div>
            </v-card-text>

            <v-card-actions class="pt-0">
              <v-btn
                class="font-weight-bold"
                color="primary"
                size="small"
                variant="text"
                @click.stop="openReport(report)"
              >
                <v-icon size="18" start>mdi-chart-box</v-icon>
                View Report
              </v-btn>
              <v-spacer />
              <v-btn
                :color="report.favorite ? 'amber' : 'grey'"
                icon
                size="small"
                variant="text"
                @click.stop="toggleFavorite(report)"
              >
                <v-icon>{{
                  report.favorite ? "mdi-star" : "mdi-star-outline"
                }}</v-icon>
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- Empty State -->
      <v-row v-if="filteredReports.length === 0">
        <v-col cols="12">
          <v-card class="text-center pa-12" elevation="2">
            <v-icon class="mb-4" color="grey-lighten-2" size="80"
              >mdi-file-remove</v-icon
            >
            <div class="text-h5 text-grey mb-2">No reports found</div>
            <div class="text-body-1 text-grey mb-4">
              Try adjusting your search or filters
            </div>
            <v-btn color="primary" @click="clearFilters">
              <v-icon class="mr-2">mdi-filter-remove</v-icon>
              Clear Filters
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <!-- Dynamic Report Viewer -->
    <div v-else class="report-viewer">
      <v-card class="mb-4" elevation="4">
        <v-card-text class="pa-4">
          <div class="d-flex align-center">
            <v-btn
              class="mr-4"
              color="primary"
              variant="text"
              @click="activeReport = null"
            >
              <v-icon start>mdi-arrow-left</v-icon>
              Back to Reports
            </v-btn>
            <div class="d-flex align-center">
              <v-avatar
                class="mr-3"
                :color="getCategoryColor(activeReport.category)"
                size="40"
                variant="tonal"
              >
                <v-icon :color="getCategoryColor(activeReport.category)">
                  {{ activeReport.icon }}
                </v-icon>
              </v-avatar>
              <div>
                <h2 class="text-h5 font-weight-bold mb-0">
                  {{ activeReport.title }}
                </h2>
                <div class="text-caption text-grey">
                  {{ activeReport.description }}
                </div>
              </div>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-card elevation="2">
        <v-card-text class="pa-0">
          <component :is="activeReport.component" />
        </v-card-text>
      </v-card>
    </div>
  </v-container>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from "vue";

// Reactive data
const search = ref("");
const selectedCategory = ref(null);
const activeReport = ref(null);
const showFavorites = ref(false);

// Predefined list of available reports
const reports = ref([
  {
    title: "Ingredients Stock Status Report",
    description:
      "Shows opening, inwards, outwards, and closing balance of ingredients within a selected period.",
    icon: "mdi-database-eye",
    category: "Inventory",
    frequency: "Daily",
    format: "PDF",
    favorite: false,
    component: defineAsyncComponent(
      () => import("@/components/reports/IngredientsStockReport.vue"),
    ),
  },
  {
    title: "Products Stock Report",
    description:
      "Shows opening, inwards, outwards, and closing balance of products within a selected period.",
    icon: "mdi-database-eye",
    category: "Inventory",
    frequency: "Daily",
    format: "PDF",
    favorite: false,
    component: defineAsyncComponent(
      () => import("@/components/reports/StockReport.vue"),
    ),
  },
  {
    title: "Quality Adjustment Report",
    description: "Shows quality adjustments of products.",
    icon: "mdi-database-eye",
    category: "Inventory",
    frequency: "Daily",
    format: "PDF",
    favorite: false,
    component: defineAsyncComponent(
      () => import("@/components/reports/QualityAdjustmentReport.vue"),
    ),
  },
]);

// Computed properties
const categories = computed(() => {
  return [...new Set(reports.value.map((report) => report.category))];
});

const filteredReports = computed(() => {
  let filtered = reports.value;

  // Search filter
  if (search.value) {
    const searchLower = search.value.toLowerCase();
    filtered = filtered.filter(
      (report) =>
        report.title.toLowerCase().includes(searchLower) ||
        report.description.toLowerCase().includes(searchLower) ||
        report.category.toLowerCase().includes(searchLower),
    );
  }

  // Category filter
  if (selectedCategory.value) {
    filtered = filtered.filter(
      (report) => report.category === selectedCategory.value,
    );
  }

  // Favorites filter
  if (showFavorites.value) {
    filtered = filtered.filter((report) => report.favorite);
  }

  return filtered;
});

const totalReports = computed(() => reports.value.length);
const analyticsReports = computed(
  () => reports.value.filter((r) => r.category === "Analytics").length,
);
const financialReports = computed(
  () => reports.value.filter((r) => r.category === "Finance").length,
);
const inventoryReports = computed(
  () => reports.value.filter((r) => r.category === "Inventory").length,
);

// Methods
function openReport(report) {
  activeReport.value = report;
}

function toggleCategory(category) {
  selectedCategory.value =
    selectedCategory.value === category ? null : category;
}

function toggleFavorite(report) {
  report.favorite = !report.favorite;
}

function clearFilters() {
  search.value = "";
  selectedCategory.value = null;
  showFavorites.value = false;
}

function getCategoryColor(category) {
  const colors = {
    Inventory: "blue",
    Analytics: "green",
    Sales: "orange",
    Finance: "purple",
    Quality: "teal",
    HR: "pink",
  };
  return colors[category] || "grey";
}

function getCategoryIcon(category) {
  const icons = {
    Inventory: "mdi-package-variant",
    Analytics: "mdi-chart-bar",
    Sales: "mdi-chart-line",
    Finance: "mdi-currency-usd",
    Quality: "mdi-quality-high",
    HR: "mdi-account-group",
  };
  return icons[category] || "mdi-file-document";
}

function getCategoryCount(category) {
  return reports.value.filter((report) => report.category === category).length;
}
</script>

<style scoped>
.reports-dashboard {
  max-width: 1400px;
  margin: 0 auto;
}

.report-card {
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s ease-in-out;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.report-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.stat-card {
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.category-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.report-meta {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 12px;
}

.transition-smooth {
  transition: all 0.25s ease;
}

.gap-2 {
  gap: 8px;
}

.search-field {
  max-width: 300px;
}

.report-viewer {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
