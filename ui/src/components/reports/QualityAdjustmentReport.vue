<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- 🎯 HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="warning" size="56">
                <v-icon color="white" size="32">mdi-autorenew</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-warning">
                  Quality Adjustments Report
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Track quality changes, replacements, and adjustments
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-btn
              color="warning"
              :loading="exporting"
              size="large"
              @click="exportToExcel"
            >
              <v-icon start>mdi-file-excel</v-icon>
              Export Excel
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 🔍 COMPREHENSIVE FILTERS -->
    <v-card class="mb-6" elevation="1">
      <v-card-text class="pa-4">
        <v-row align="center" dense>
          <v-col cols="12" sm="2">
            <v-autocomplete
              v-model="filters.product_id"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="products"
              label="Product"
              :loading="loadingProducts"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-autocomplete
              v-model="filters.outlet_id"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="outlets"
              label="Outlet"
              :loading="loadingOutlets"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.from_quality"
              clearable
              density="comfortable"
              item-title="text"
              item-value="value"
              :items="qualityOptions"
              label="From Quality"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.to_quality"
              clearable
              density="comfortable"
              item-title="text"
              item-value="value"
              :items="qualityOptions"
              label="To Quality"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.is_replacement"
              clearable
              density="comfortable"
              item-title="text"
              item-value="value"
              :items="replacementOptions"
              label="Replacement"
              variant="outlined"
            />
          </v-col>

          <!-- Date Range Picker -->
          <v-col cols="12" sm="2">
            <v-menu>
              <template #activator="{ props }">
                <v-text-field
                  v-bind="props"
                  density="comfortable"
                  label="Date Range"
                  :model-value="dateRangeText"
                  prepend-inner-icon="mdi-calendar"
                  readonly
                  variant="outlined"
                />
              </template>
              <v-date-picker
                v-model="dateRange"
                range
                @update:model-value="onDateRangeChange"
              />
            </v-menu>
          </v-col>

          <v-col class="d-flex justify-end" cols="12" sm="2">
            <v-btn
              class="mr-2"
              color="warning"
              :loading="loading"
              variant="flat"
              @click="loadReport"
            >
              <v-icon start>mdi-magnify</v-icon>
              Generate
            </v-btn>
            <v-btn color="grey" variant="outlined" @click="resetFilters">
              <v-icon start>mdi-refresh</v-icon>
              Reset
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 📊 SUMMARY CARDS -->
    <v-row class="mb-6" dense>
      <v-col cols="12" md="3" sm="6">
        <v-card color="blue-lighten-5" elevation="1">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="blue" size="48">
                <v-icon color="white">mdi-autorenew</v-icon>
              </v-avatar>
              <div>
                <div class="text-caption text-grey">TOTAL ADJUSTMENTS</div>
                <div class="text-h5 font-weight-bold">
                  {{ summary.totalAdjustments }}
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card color="green-lighten-5" elevation="1">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="green" size="48">
                <v-icon color="white">mdi-package-variant</v-icon>
              </v-avatar>
              <div>
                <div class="text-caption text-grey">TOTAL QUANTITY</div>
                <div class="text-h5 font-weight-bold">
                  {{ formatNumber(summary.totalQuantity) }}
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card color="orange-lighten-5" elevation="1">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="orange" size="48">
                <v-icon color="white">mdi-currency-usd</v-icon>
              </v-avatar>
              <div>
                <div class="text-caption text-grey">TOTAL VALUE</div>
                <div class="text-h5 font-weight-bold">
                  {{ formatCurrency(summary.totalValue) }}
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card color="purple-lighten-5" elevation="1">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="purple" size="48">
                <v-icon color="white">mdi-repeat</v-icon>
              </v-avatar>
              <div>
                <div class="text-caption text-grey">REPLACEMENTS</div>
                <div class="text-h5 font-weight-bold">
                  {{ summary.replacementCount }}
                </div>
                <div class="text-caption text-grey">
                  {{
                    (
                      (summary.replacementCount / summary.totalAdjustments) *
                        100 || 0
                    ).toFixed(1)
                  }}%
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 📈 QUALITY ADJUSTMENT CHARTS -->
    <v-row
      v-if="chartData.qualityFlow && chartData.qualityFlow.length > 0"
      class="mb-6"
    >
      <!-- Quality Flow Chart -->
      <v-col cols="12" lg="6">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="warning">mdi-transfer</v-icon>
            Quality Flow Analysis
          </v-card-title>
          <v-card-text class="pa-4">
            <div ref="qualityFlowChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Replacement Analysis -->
      <v-col cols="12" lg="6">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="warning">mdi-swap-horizontal</v-icon>
            Replacement Analysis
          </v-card-title>
          <v-card-text class="pa-4">
            <div ref="replacementChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Monthly Trend -->
      <v-col cols="12" lg="8">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="warning">mdi-chart-line</v-icon>
            Monthly Adjustment Trend
          </v-card-title>
          <v-card-text class="pa-4">
            <div ref="monthlyTrendChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Top Products -->
      <v-col cols="12" lg="4">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="warning">mdi-star</v-icon>
            Top Products by Adjustments
          </v-card-title>
          <v-card-text class="pa-4">
            <div ref="productsChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 📋 ADJUSTMENTS DATA TABLE -->
    <v-card elevation="2">
      <v-progress-linear
        :active="loading"
        color="warning"
        height="4"
        :indeterminate="loading"
      />
      <v-data-table-server
        v-model:items-per-page="pagination.limit"
        v-model:page="pagination.currentPage"
        :headers="headers"
        :items="reportData"
        :items-length="pagination.totalRecords"
        :loading="loading"
        loading-text="Loading quality adjustments..."
        no-data-text="No quality adjustments found"
        @update:options="handlePagination"
      >
        <template #top>
          <v-card-title class="d-flex align-center pt-4">
            <v-icon class="mr-2" color="warning">mdi-table</v-icon>
            Quality Adjustment Details
            <v-chip class="ml-3" color="warning" size="small" variant="flat">
              {{ formatNumber(pagination.totalRecords) }} total records
            </v-chip>
          </v-card-title>
          <v-divider />
        </template>

        <!-- Formatted Date Column -->
        <template #item.movement_date="{ item }">
          <div class="text-center">
            {{ formatDateDDMMYYYY(item.movement_date) }}
          </div>
        </template>

        <template #item.product_name="{ item }">
          <div class="d-flex align-center">
            <v-avatar class="mr-3" color="blue" size="36">
              <v-icon color="white" size="18">mdi-cube</v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.product_name }}</div>
              <div class="text-caption text-grey">{{ item.unit }}</div>
            </div>
          </div>
        </template>

        <template #item.outlet_name="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              class="mr-2"
              :color="getOutletColor(item.outlet_type)"
              size="32"
            >
              <v-icon color="white" size="16">{{
                getOutletIcon(item.outlet_type)
              }}</v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.outlet_name }}</div>
              <div class="text-caption text-grey">{{ item.outlet_type }}</div>
            </div>
          </div>
        </template>

        <template #item.quality_flow="{ item }">
          <div class="d-flex align-center justify-center">
            <v-chip
              :color="getQualityColor(item.from_quality)"
              size="small"
              variant="flat"
            >
              {{ item.from_quality }}
            </v-chip>
            <v-icon class="mx-2" color="grey" size="16">mdi-arrow-right</v-icon>
            <v-chip
              :color="getQualityColor(item.to_quality)"
              size="small"
              variant="flat"
            >
              {{ item.to_quality }}
            </v-chip>
          </div>
        </template>

        <template #item.quantity="{ item }">
          <v-chip
            :color="getQuantityColor(item.quantity)"
            size="small"
            variant="flat"
          >
            {{ formatNumber(item.quantity) }}
          </v-chip>
        </template>

        <template #item.is_replacement="{ item }">
          <v-chip
            :color="item.is_replacement ? 'red' : 'green'"
            size="small"
            variant="flat"
          >
            <v-icon
              :icon="item.is_replacement ? 'mdi-alert' : 'mdi-check'"
              start
            />
            {{ item.is_replacement ? "Yes" : "No" }}
          </v-chip>
        </template>

        <template #item.adjustment_value="{ item }">
          <div class="text-right font-weight-medium">
            {{ formatCurrency(item.adjustment_value) }}
          </div>
        </template>

        <template #item.replacement_note="{ item }">
          <span v-if="item.replacement_note" class="text-caption">
            {{ item.replacement_note }}
          </span>
          <span v-else class="text-caption text-grey">-</span>
        </template>

        <template #bottom>
          <v-card-actions class="px-4 py-3 bg-grey-lighten-3">
            <div class="text-caption text-grey">
              Showing {{ getDisplayRange() }} of
              {{ formatNumber(pagination.totalRecords) }} adjustments
            </div>
            <v-spacer />
            <v-select
              v-model="pagination.limit"
              density="compact"
              :items="[10, 20, 50, 100]"
              label="Items per page"
              style="max-width: 150px"
              variant="outlined"
              @update:model-value="loadReport"
            />
            <v-pagination
              v-model="pagination.currentPage"
              color="warning"
              :length="pagination.totalPages"
              total-visible="7"
              @update:model-value="loadReport"
            />
          </v-card-actions>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import { useStore } from "vuex";
import * as echarts from "echarts";

const store = useStore();

// Data
const loading = ref(false);
const exporting = ref(false);
const loadingProducts = ref(false);
const loadingOutlets = ref(false);
const reportData = ref([]);
const chartData = ref({});
const summary = ref({
  totalAdjustments: 0,
  totalQuantity: 0,
  totalValue: 0,
  uniqueProducts: 0,
  uniqueOutlets: 0,
  replacementCount: 0,
  nonReplacementCount: 0,
  averageQuantity: 0,
});

// Products and Outlets data
const products = ref([]);
const outlets = ref([]);

// Chart instances
let qualityFlowChartInstance = null;
let replacementChartInstance = null;
let monthlyTrendChartInstance = null;
let productsChartInstance = null;

// Chart refs
const qualityFlowChart = ref(null);
const replacementChart = ref(null);
const monthlyTrendChart = ref(null);
const productsChart = ref(null);

// Options
const qualityOptions = [
  { text: "All Qualities", value: "ALL" },
  { text: "Good", value: "GOOD" },
  { text: "Damaged", value: "DAMAGED" },
  { text: "Reject", value: "REJECT" },
];

const replacementOptions = [
  { text: "All Types", value: "ALL" },
  { text: "Replacement Only", value: "true" },
  { text: "Non-Replacement Only", value: "false" },
];

// Date Range
const dateRange = ref([
  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split("T")[0],
  new Date().toISOString().split("T")[0],
]);

// Computed for date range display
const dateRangeText = computed(() => {
  if (dateRange.value && dateRange.value.length === 2) {
    return `${formatDateDDMMYYYY(dateRange.value[0])} - ${formatDateDDMMYYYY(dateRange.value[1])}`;
  }
  return "Select Date Range";
});

// Pagination
const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  limit: 20,
});

// Filters
const filters = reactive({
  product_id: "",
  outlet_id: "",
  from_quality: "",
  to_quality: "",
  is_replacement: "",
  start_date: dateRange.value[0],
  end_date: dateRange.value[1],
});

const headers = [
  { title: "Date", key: "movement_date", sortable: false, align: "center" },
  { title: "Product", key: "product_name", sortable: false },
  { title: "Outlet", key: "outlet_name", sortable: false },
  {
    title: "Quality Flow",
    key: "quality_flow",
    align: "center",
    sortable: false,
  },
  { title: "Quantity", key: "quantity", align: "center", sortable: false },
  {
    title: "Replacement",
    key: "is_replacement",
    align: "center",
    sortable: false,
  },
  {
    title: "Reference Type",
    key: "reference_type",
    align: "center",
    sortable: false,
  },
  { title: "Replacement Note", key: "replacement_note", sortable: false },
  {
    title: "Adjustment Value",
    key: "adjustment_value",
    align: "right",
    sortable: false,
  },
  { title: "Created By", key: "created_by_name", sortable: false },
];

// Computed
const filterParams = computed(() => {
  const params = new URLSearchParams();
  if (filters.product_id) params.append("product_id", filters.product_id);
  if (filters.outlet_id) params.append("outlet_id", filters.outlet_id);
  if (filters.from_quality) params.append("from_quality", filters.from_quality);
  if (filters.to_quality) params.append("to_quality", filters.to_quality);
  if (filters.is_replacement)
    params.append("is_replacement", filters.is_replacement);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  params.append("page", pagination.currentPage);
  params.append("limit", pagination.limit);
  return params;
});

// Methods
function formatDateDDMMYYYY(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function getQualityColor(quality) {
  const colors = { GOOD: "green", DAMAGED: "orange", REJECT: "red" };
  return colors[quality] || "grey";
}

function getQuantityColor(quantity) {
  if (quantity > 50) return "red";
  if (quantity > 20) return "orange";
  return "blue";
}

function getOutletColor(type) {
  const colors = { MAIN: "primary", SHOP: "success", CAR: "warning" };
  return colors[type] || "grey";
}

function getOutletIcon(type) {
  const icons = { MAIN: "mdi-home", SHOP: "mdi-store", CAR: "mdi-truck" };
  return icons[type] || "mdi-store";
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatNumber(num) {
  return new Intl.NumberFormat().format(num);
}

function getDisplayRange() {
  const start = (pagination.currentPage - 1) * pagination.limit + 1;
  const end = Math.min(
    pagination.currentPage * pagination.limit,
    pagination.totalRecords,
  );
  return `${formatNumber(start)} - ${formatNumber(end)}`;
}

function onDateRangeChange(newRange) {
  if (newRange && newRange.length === 2) {
    filters.start_date = newRange[0];
    filters.end_date = newRange[1];
  }
}

async function loadReport() {
  loading.value = true;
  try {
    const res = await fetch(
      `/reports/quality-adjustments?${filterParams.value}`,
    );
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    reportData.value = data.data || [];

    // Format dates in the data
    reportData.value = reportData.value.map((item) => ({
      ...item,
      movement_date_formatted: formatDateDDMMYYYY(item.movement_date),
    }));

    chartData.value = data.chartData || {};
    summary.value = data.summary || {};

    if (data.pagination) {
      Object.assign(pagination, data.pagination);
    }

    await nextTick();
    renderCharts();
  } catch (error) {
    console.error("Error loading quality adjustments report:", error);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load quality adjustments report",
    });
  } finally {
    loading.value = false;
  }
}

function handlePagination(options) {
  if (
    options.page !== pagination.currentPage ||
    options.itemsPerPage !== pagination.limit
  ) {
    pagination.currentPage = options.page;
    pagination.limit = options.itemsPerPage;
    loadReport();
  }
}

function renderCharts() {
  // Clean up existing charts
  [
    qualityFlowChartInstance,
    replacementChartInstance,
    monthlyTrendChartInstance,
    productsChartInstance,
  ].forEach((instance) => instance?.dispose());

  // Quality Flow Chart
  if (qualityFlowChart.value && chartData.value.qualityFlow?.length > 0) {
    qualityFlowChartInstance = echarts.init(qualityFlowChart.value);
    const flowOption = {
      tooltip: {
        trigger: "item",
        formatter: "{a} <br/>{b}: {c} ({d}%)",
      },
      legend: { orient: "vertical", right: 10, top: "center" },
      series: [
        {
          name: "Quality Flow",
          type: "pie",
          radius: ["40%", "70%"],
          data: chartData.value.qualityFlow.map((item) => ({
            name: item.flow,
            value: item.quantity,
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };
    qualityFlowChartInstance.setOption(flowOption);
  }

  // Replacement Analysis Chart
  if (replacementChart.value && chartData.value.replacementAnalysis) {
    replacementChartInstance = echarts.init(replacementChart.value);
    const replacementOption = {
      tooltip: { trigger: "item", formatter: "{a} <br/>{b}: {c} ({d}%)" },
      series: [
        {
          name: "Replacement Analysis",
          type: "pie",
          radius: "50%",
          data: [
            {
              name: "Replacement",
              value: chartData.value.replacementAnalysis.replacement,
            },
            {
              name: "Non-Replacement",
              value: chartData.value.replacementAnalysis.nonReplacement,
            },
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
        },
      ],
    };
    replacementChartInstance.setOption(replacementOption);
  }

  // Monthly Trend Chart
  if (monthlyTrendChart.value && chartData.value.monthlyTrend?.length > 0) {
    monthlyTrendChartInstance = echarts.init(monthlyTrendChart.value);
    const trendOption = {
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: chartData.value.monthlyTrend.map((item) => item.month),
      },
      yAxis: [
        { type: "value", name: "Quantity" },
        { type: "value", name: "Value" },
      ],
      series: [
        {
          name: "Quantity",
          type: "bar",
          data: chartData.value.monthlyTrend.map((item) => item.quantity),
        },
        {
          name: "Value",
          type: "line",
          yAxisIndex: 1,
          data: chartData.value.monthlyTrend.map((item) => item.value),
        },
      ],
    };
    monthlyTrendChartInstance.setOption(trendOption);
  }

  // Products Chart
  if (productsChart.value && chartData.value.productBreakdown?.length > 0) {
    productsChartInstance = echarts.init(productsChart.value);
    const productsOption = {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value" },
      yAxis: {
        type: "category",
        data: chartData.value.productBreakdown.map((item) =>
          item.product.length > 15
            ? item.product.substring(0, 15) + "..."
            : item.product,
        ),
        axisLabel: { interval: 0, rotate: 0 },
      },
      series: [
        {
          name: "Adjustments",
          type: "bar",
          data: chartData.value.productBreakdown.map((item) => item.quantity),
        },
      ],
    };
    productsChartInstance.setOption(productsOption);
  }
}

async function exportToExcel() {
  exporting.value = true;
  try {
    // Implement export logic
    store.commit("setMessage", {
      type: "success",
      text: "Export feature coming soon!",
    });
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to export report",
    });
  } finally {
    exporting.value = false;
  }
}

function resetFilters() {
  filters.product_id = "";
  filters.outlet_id = "";
  filters.from_quality = "";
  filters.to_quality = "";
  filters.is_replacement = "";

  // Reset date range
  const defaultStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .split("T")[0];
  const defaultEnd = new Date().toISOString().split("T")[0];

  dateRange.value = [defaultStart, defaultEnd];
  filters.start_date = defaultStart;
  filters.end_date = defaultEnd;

  pagination.currentPage = 1;
  loadReport();
}

// Data loading functions
async function loadOutlets() {
  loadingOutlets.value = true;
  try {
    const res = await fetch("/outlets?limit=1000&active=true");
    if (res.ok) {
      const data = await res.json();
      outlets.value = data.data || [];
    }
  } catch (error) {
    console.error("Error loading outlets:", error);
  } finally {
    loadingOutlets.value = false;
  }
}

async function loadProducts() {
  loadingProducts.value = true;
  try {
    const res = await fetch("/products?limit=1000&active=true");
    if (res.ok) {
      const data = await res.json();
      products.value = data.data || [];
    }
  } catch (error) {
    console.error("Error loading products:", error);
  } finally {
    loadingProducts.value = false;
  }
}

// Initialization
async function loadInitialData() {
  await Promise.all([loadOutlets(), loadProducts()]);
  await loadReport();
}

// Watch for filter changes
let filterTimeout = null;
watch(
  () => ({ ...filters }),
  () => {
    pagination.currentPage = 1;
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      loadReport();
    }, 500);
  },
  { deep: true },
);

// Lifecycle
onMounted(() => {
  loadInitialData();
});

onUnmounted(() => {
  [
    qualityFlowChartInstance,
    replacementChartInstance,
    monthlyTrendChartInstance,
    productsChartInstance,
  ].forEach((instance) => instance?.dispose());
  if (filterTimeout) clearTimeout(filterTimeout);
});
</script>
