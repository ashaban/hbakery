<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- 🎯 HEADER (unchanged) -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-chart-box</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Stock Balance Report
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Aggregated inventory balances and movements with quality
                  tracking
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-btn
              color="primary"
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

    <!-- 🔍 ENHANCED FILTERS WITH QUALITY -->
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
              v-model="filters.quality"
              clearable
              density="comfortable"
              item-title="text"
              item-value="value"
              :items="qualityOptions"
              label="Quality"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-text-field
              v-model="filters.start_date"
              density="comfortable"
              label="Start Date"
              :max="filters.end_date"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-text-field
              v-model="filters.end_date"
              density="comfortable"
              label="End Date"
              :min="filters.start_date"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex justify-end">
            <v-btn
              class="mr-2"
              color="primary"
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
                <v-icon color="white">mdi-package-variant</v-icon>
              </v-avatar>
              <div>
                <div class="text-caption text-grey">TOTAL PRODUCTS</div>
                <div class="text-h5 font-weight-bold">
                  {{ summary.totalProducts }}
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
                <v-icon color="white">mdi-trending-up</v-icon>
              </v-avatar>
              <div>
                <div class="text-caption text-grey">TOTAL INCOMING</div>
                <div class="text-h5 font-weight-bold">
                  {{ formatNumber(summary.totalIncoming) }}
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
                <v-icon color="white">mdi-trending-down</v-icon>
              </v-avatar>
              <div>
                <div class="text-caption text-grey">TOTAL OUTGOING</div>
                <div class="text-h5 font-weight-bold">
                  {{ formatNumber(summary.totalOutgoing) }}
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
    </v-row>

    <!-- 📈 CHARTS SECTION -->
    <v-row
      v-if="chartData.products && chartData.products.length > 0"
      class="mb-6"
    >
      <!-- Existing Product Distribution Chart -->
      <v-col cols="12" lg="6">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-chart-pie</v-icon>
            Stock Distribution by Product
          </v-card-title>
          <v-card-text class="pa-4">
            <div ref="productChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Existing Outlet Stock Value Chart -->
      <v-col cols="12" lg="6">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-chart-bar</v-icon>
            Stock Value by Outlet
          </v-card-title>
          <v-card-text class="pa-4">
            <div ref="outletChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- NEW: Quality Distribution by Product Chart -->
      <v-col cols="12" lg="8">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-stack-overflow</v-icon>
            Quality Distribution by Product
          </v-card-title>
          <v-card-text class="pa-4">
            <div ref="qualityChart" style="height: 500px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- NEW: Quality Summary Card -->
      <v-col cols="12" lg="4">
        <v-card elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-quality-high</v-icon>
            Quality Summary
          </v-card-title>
          <v-card-text class="pa-4">
            <v-list>
              <v-list-item>
                <template #prepend>
                  <v-avatar color="green" size="32">
                    <v-icon color="white" size="18">mdi-check</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium"
                  >Good Stock</v-list-item-title
                >
                <v-list-item-subtitle
                  >{{
                    formatNumber(qualitySummary.good)
                  }}
                  units</v-list-item-subtitle
                >
                <template #append>
                  <v-chip color="green" variant="flat">
                    {{ qualitySummary.goodPercentage }}%
                  </v-chip>
                </template>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-avatar color="orange" size="32">
                    <v-icon color="white" size="18">mdi-alert</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium"
                  >Damaged Stock</v-list-item-title
                >
                <v-list-item-subtitle
                  >{{
                    formatNumber(qualitySummary.damaged)
                  }}
                  units</v-list-item-subtitle
                >
                <template #append>
                  <v-chip color="orange" variant="flat">
                    {{ qualitySummary.damagedPercentage }}%
                  </v-chip>
                </template>
              </v-list-item>

              <v-list-item>
                <template #prepend>
                  <v-avatar color="red" size="32">
                    <v-icon color="white" size="18">mdi-close</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium"
                  >Reject Stock</v-list-item-title
                >
                <v-list-item-subtitle
                  >{{
                    formatNumber(qualitySummary.reject)
                  }}
                  units</v-list-item-subtitle
                >
                <template #append>
                  <v-chip color="red" variant="flat">
                    {{ qualitySummary.rejectPercentage }}%
                  </v-chip>
                </template>
              </v-list-item>

              <v-divider class="my-2" />

              <v-list-item>
                <template #prepend>
                  <v-avatar color="blue" size="32">
                    <v-icon color="white" size="18">mdi-package-variant</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium"
                  >Total Stock</v-list-item-title
                >
                <v-list-item-subtitle
                  >{{
                    formatNumber(qualitySummary.total)
                  }}
                  units</v-list-item-subtitle
                >
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- 📋 DATA TABLE -->
    <v-card elevation="2">
      <v-progress-linear
        :active="loading"
        color="primary"
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
        loading-text="Loading stock report..."
        no-data-text="No stock data found"
        @update:options="handlePagination"
      >
        <template #top>
          <v-card-title class="d-flex align-center pt-4">
            <v-icon class="mr-2" color="primary">mdi-table</v-icon>
            Stock Balance Details
            <v-chip class="ml-3" color="primary" size="small" variant="flat">
              {{ formatNumber(pagination.totalRecords) }} total records
            </v-chip>
            <v-chip
              class="ml-2"
              :color="getQualityColor(filters.quality)"
              size="small"
              variant="flat"
            >
              Quality: {{ getQualityText(filters.quality) }}
            </v-chip>
          </v-card-title>
          <v-divider />
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
              <v-icon color="white" size="16">
                {{ getOutletIcon(item.outlet_type) }}
              </v-icon>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.outlet_name }}</div>
              <div class="text-caption text-grey">{{ item.outlet_type }}</div>
            </div>
          </div>
        </template>

        <!-- ENHANCED: Quality Breakdown Display -->
        <template #item.quality_breakdown="{ item }">
          <v-tooltip location="top">
            <template #activator="{ props }">
              <div v-bind="props" class="quality-breakdown-container">
                <div class="quality-breakdown-bar">
                  <div
                    v-if="item.quality_breakdown.good > 0"
                    class="quality-segment good"
                    :style="{
                      width: getSegmentWidth(item.quality_breakdown, 'good'),
                    }"
                    :title="`Good: ${formatNumber(item.quality_breakdown.good)}`"
                  />
                  <div
                    v-if="item.quality_breakdown.damaged > 0"
                    class="quality-segment damaged"
                    :style="{
                      width: getSegmentWidth(item.quality_breakdown, 'damaged'),
                    }"
                    :title="`Damaged: ${formatNumber(item.quality_breakdown.damaged)}`"
                  />
                  <div
                    v-if="item.quality_breakdown.reject > 0"
                    class="quality-segment reject"
                    :style="{
                      width: getSegmentWidth(item.quality_breakdown, 'reject'),
                    }"
                    :title="`Reject: ${formatNumber(item.quality_breakdown.reject)}`"
                  />
                </div>
                <div class="text-caption text-center mt-1">
                  {{ formatNumber(item.quality_breakdown.total) }} total
                </div>
              </div>
            </template>
            <v-card class="pa-2">
              <div class="text-caption font-weight-bold mb-1">
                Quality Breakdown
              </div>
              <div class="d-flex align-center mb-1">
                <div class="quality-indicator good mr-2" />
                <span
                  >Good: {{ formatNumber(item.quality_breakdown.good) }}</span
                >
              </div>
              <div class="d-flex align-center mb-1">
                <div class="quality-indicator damaged mr-2" />
                <span
                  >Damaged:
                  {{ formatNumber(item.quality_breakdown.damaged) }}</span
                >
              </div>
              <div class="d-flex align-center">
                <div class="quality-indicator reject mr-2" />
                <span
                  >Reject:
                  {{ formatNumber(item.quality_breakdown.reject) }}</span
                >
              </div>
            </v-card>
          </v-tooltip>
        </template>

        <template #item.opening_balance="{ item }">
          <v-chip
            :color="getBalanceColor(item.opening_balance)"
            size="small"
            variant="flat"
          >
            {{ formatNumber(item.opening_balance) }}
          </v-chip>
        </template>

        <template #item.incoming="{ item }">
          <v-chip color="green" size="small" variant="flat">
            +{{ formatNumber(item.incoming) }}
          </v-chip>
        </template>

        <template #item.outgoing="{ item }">
          <v-chip color="orange" size="small" variant="flat">
            -{{ formatNumber(item.outgoing) }}
          </v-chip>
        </template>

        <template #item.closing_balance="{ item }">
          <v-chip
            :color="getBalanceColor(item.closing_balance)"
            size="small"
            variant="flat"
          >
            {{ formatNumber(item.closing_balance) }}
          </v-chip>
        </template>

        <template #item.total_value="{ item }">
          <div class="text-right font-weight-medium">
            {{ formatCurrency(item.total_value) }}
          </div>
        </template>

        <template #bottom>
          <v-card-actions class="px-4 py-3 bg-grey-lighten-3">
            <div class="text-caption text-grey">
              Showing {{ getDisplayRange() }} of
              {{ formatNumber(pagination.totalRecords) }} records
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
              color="primary"
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
const qualityChart = ref(null);
let qualityChartInstance = null;

// Data
const loading = ref(false);
const exporting = ref(false);
const loadingProducts = ref(false);
const loadingOutlets = ref(false);
const reportData = ref([]);
const chartData = ref({});
const summary = ref({
  totalProducts: 0,
  totalOutlets: 0,
  totalOpening: 0,
  totalIncoming: 0,
  totalOutgoing: 0,
  totalClosing: 0,
  totalValue: 0,
});
const outlets = ref([]);
const products = ref([]);

// Quality options
const qualityOptions = [
  { text: "All Qualities", value: "ALL" },
  { text: "Good Only", value: "GOOD" },
  { text: "Damaged Only", value: "DAMAGED" },
  { text: "Reject Only", value: "REJECT" },
];

// Chart instances
let productChartInstance = null;
let outletChartInstance = null;

// Pagination
const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  limit: 20,
});

// Chart refs
const productChart = ref(null);
const outletChart = ref(null);

// Enhanced Filters with Quality
const filters = reactive({
  product_id: "",
  outlet_id: "",
  quality: "GOOD", // Default to GOOD
  start_date: new Date().toISOString().split("T")[0],
  end_date: new Date().toISOString().split("T")[0],
});

// Enhanced Headers with Quality Breakdown
const headers = [
  { title: "Product", key: "product_name", sortable: false },
  { title: "Outlet", key: "outlet_name", sortable: false },
  {
    title: "Quality Breakdown",
    key: "quality_breakdown",
    align: "center",
    sortable: false,
    width: "150px",
  },
  {
    title: "Opening",
    key: "opening_balance",
    align: "center",
    sortable: false,
  },
  { title: "Incoming", key: "incoming", align: "center", sortable: false },
  { title: "Outgoing", key: "outgoing", align: "center", sortable: false },
  {
    title: "Closing",
    key: "closing_balance",
    align: "center",
    sortable: false,
  },
  { title: "Total Value", key: "total_value", align: "right", sortable: false },
];

// Computed
const filterParams = computed(() => {
  const params = new URLSearchParams();
  if (filters.product_id) params.append("product_id", filters.product_id);
  if (filters.outlet_id) params.append("outlet_id", filters.outlet_id);
  if (filters.quality) params.append("quality", filters.quality);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  params.append("page", pagination.currentPage);
  params.append("limit", pagination.limit);
  return params;
});

const qualitySummary = computed(() => {
  if (!chartData.value.qualityDistribution) {
    return {
      good: 0,
      damaged: 0,
      reject: 0,
      total: 0,
      goodPercentage: 0,
      damagedPercentage: 0,
      rejectPercentage: 0,
    };
  }

  const totalGood = chartData.value.qualityDistribution.reduce(
    (sum, item) => sum + item.good,
    0,
  );
  const totalDamaged = chartData.value.qualityDistribution.reduce(
    (sum, item) => sum + item.damaged,
    0,
  );
  const totalReject = chartData.value.qualityDistribution.reduce(
    (sum, item) => sum + item.reject,
    0,
  );
  const total = totalGood + totalDamaged + totalReject;

  return {
    good: totalGood,
    damaged: totalDamaged,
    reject: totalReject,
    total,
    goodPercentage: total > 0 ? ((totalGood / total) * 100).toFixed(1) : 0,
    damagedPercentage:
      total > 0 ? ((totalDamaged / total) * 100).toFixed(1) : 0,
    rejectPercentage: total > 0 ? ((totalReject / total) * 100).toFixed(1) : 0,
  };
});

// Enhanced Methods
function getQualityColor(quality) {
  const colors = {
    GOOD: "green",
    DAMAGED: "orange",
    REJECT: "red",
    ALL: "primary",
  };
  return colors[quality] || "grey";
}

function getQualityText(quality) {
  const texts = {
    GOOD: "Good",
    DAMAGED: "Damaged",
    REJECT: "Reject",
    ALL: "All Qualities",
  };
  return texts[quality] || quality;
}

function getSegmentWidth(breakdown, type) {
  const total = breakdown.total || 1; // Avoid division by zero
  const percentage = (breakdown[type] / total) * 100;
  return `${Math.max(percentage, 5)}%`; // Minimum 5% width for visibility
}

// Methods
function getOutletColor(type) {
  const colors = { MAIN: "primary", SHOP: "success", CAR: "warning" };
  return colors[type] || "grey";
}

function getOutletIcon(type) {
  const icons = { MAIN: "mdi-home", SHOP: "mdi-store", CAR: "mdi-truck" };
  return icons[type] || "mdi-store";
}

function getBalanceColor(balance) {
  if (balance > 0) return "green";
  if (balance < 0) return "red";
  return "grey";
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

async function loadReport() {
  loading.value = true;
  try {
    const res = await fetch(`/reports/stock-balance?${filterParams.value}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();

    reportData.value = data.data || [];
    chartData.value = data.chartData || {};
    summary.value = data.summary || {};

    // Update pagination info
    if (data.pagination) {
      Object.assign(pagination, data.pagination);
    }

    // Render charts after data loads
    await nextTick();
    renderCharts();
  } catch (error) {
    console.error("Error loading stock report:", error);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load stock report",
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
  if (productChartInstance) productChartInstance.dispose();
  if (outletChartInstance) outletChartInstance.dispose();
  if (qualityChartInstance) qualityChartInstance.dispose();

  // Product Distribution Pie Chart
  if (productChart.value && chartData.value.products?.length > 0) {
    productChartInstance = echarts.init(productChart.value);
    const pieOption = {
      tooltip: {
        trigger: "item",
        formatter: "{a} <br/>{b}: {c} ({d}%)",
      },
      legend: {
        orient: "vertical",
        right: 10,
        top: "center",
        type: "scroll",
      },
      series: [
        {
          name: "Closing Balance",
          type: "pie",
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: "#fff",
            borderWidth: 2,
          },
          label: {
            show: false,
            position: "center",
          },
          emphasis: {
            label: {
              show: true,
              fontSize: "18",
              fontWeight: "bold",
            },
          },
          labelLine: {
            show: false,
          },
          data: chartData.value.products.map((item) => ({
            name:
              item.name.length > 20
                ? item.name.substring(0, 20) + "..."
                : item.name,
            value: item.closing,
          })),
        },
      ],
    };
    productChartInstance.setOption(pieOption);
  }

  // Outlet Stock Value Bar Chart
  if (outletChart.value && chartData.value.outlets?.length > 0) {
    outletChartInstance = echarts.init(outletChart.value);
    const barOption = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params) => {
          const data = params[0];
          return `${data.name}<br/>${formatCurrency(data.value)}`;
        },
      },
      xAxis: {
        type: "category",
        data: chartData.value.outlets.map((item) =>
          item.name.length > 15
            ? item.name.substring(0, 15) + "..."
            : item.name,
        ),
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: "value",
        name: "Stock Value ($)",
        axisLabel: {
          formatter: (value) => formatCurrency(value),
        },
      },
      series: [
        {
          name: "Stock Value",
          type: "bar",
          data: chartData.value.outlets.map((item) => item.value),
          itemStyle: {
            color: "#2196F3",
          },
        },
      ],
    };
    outletChartInstance.setOption(barOption);
  }
  if (qualityChart.value && chartData.value.qualityDistribution?.length > 0) {
    qualityChartInstance = echarts.init(qualityChart.value);

    const qualityOption = {
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter(params) {
          let result = `<div class="font-weight-bold">${params[0].name}</div>`;
          let total = 0;

          params.forEach((param) => {
            result += `<div style="display: flex; justify-content: space-between; align-items: center; margin: 5px 0;">
              <span style="display: inline-block; width: 12px; height: 12px; background: ${param.color}; border-radius: 2px; margin-right: 8px;"></span>
              <span style="flex: 1;">${param.seriesName}:</span>
              <span style="font-weight: bold; margin-left: 10px;">${formatNumber(param.value)}</span>
            </div>`;
            total += param.value;
          });

          result += `<hr style="margin: 8px 0;">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span>Total:</span>
              <span>${formatNumber(total)}</span>
            </div>`;

          return result;
        },
      },
      legend: {
        data: ["Good", "Damaged", "Reject"],
        top: 10,
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "3%",
        top: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "value",
        name: "Quantity",
        axisLabel: {
          formatter(value) {
            return formatNumber(value);
          },
        },
      },
      yAxis: {
        type: "category",
        data: chartData.value.qualityDistribution.map((item) =>
          item.product.length > 20
            ? item.product.substring(0, 20) + "..."
            : item.product,
        ),
        axisLabel: {
          interval: 0,
          rotate: 0,
        },
      },
      series: [
        {
          name: "Good",
          type: "bar",
          stack: "total",
          emphasis: { focus: "series" },
          data: chartData.value.qualityDistribution.map((item) => item.good),
          itemStyle: { color: "#4CAF50" },
        },
        {
          name: "Damaged",
          type: "bar",
          stack: "total",
          emphasis: { focus: "series" },
          data: chartData.value.qualityDistribution.map((item) => item.damaged),
          itemStyle: { color: "#FF9800" },
        },
        {
          name: "Reject",
          type: "bar",
          stack: "total",
          emphasis: { focus: "series" },
          data: chartData.value.qualityDistribution.map((item) => item.reject),
          itemStyle: { color: "#F44336" },
        },
      ],
    };

    qualityChartInstance.setOption(qualityOption);
  }
}

async function exportToExcel() {
  exporting.value = true;
  try {
    // Remove filters for full data export
    const exportParams = new URLSearchParams();
    if (filters.start_date)
      exportParams.append("start_date", filters.start_date);
    if (filters.end_date) exportParams.append("end_date", filters.end_date);

    const res = await fetch(`/reports/stock-balance/export?${exportParams}`);
    const blob = await res.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-balance-${new Date().toISOString().split("T")[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    store.commit("setMessage", {
      type: "success",
      text: "Report exported successfully!",
    });
  } catch (error) {
    console.error("Export error:", error);
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
  filters.start_date = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .split("T")[0];
  filters.end_date = new Date().toISOString().split("T")[0];
  pagination.currentPage = 1;
  loadReport();
}

// Data loading functions
async function loadOutlets() {
  loadingOutlets.value = true;
  try {
    const outletsParams = new URLSearchParams({ limit: 1000, active: "true" });
    if (store.state.auth.outlets.length) {
      store.state.auth.outlets.forEach((outlet) =>
        outletsParams.append("id[]", outlet.outlet_id),
      );
    } else {
      outletsParams.append("id[]", -1); // force no outlets
    }
    const res = await fetch(`/outlets?${outletsParams}`);
    const data = await res.json();
    outlets.value = data.data || [];
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
    const data = await res.json();
    products.value = data.data || [];
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

// Watch for filter changes with debounce
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
  if (productChartInstance) productChartInstance.dispose();
  if (outletChartInstance) outletChartInstance.dispose();
  if (qualityChartInstance) qualityChartInstance.dispose();
  if (filterTimeout) clearTimeout(filterTimeout);
});

onUnmounted(() => {
  if (productChartInstance) {
    productChartInstance.dispose();
  }
  if (outletChartInstance) {
    outletChartInstance.dispose();
  }
  if (filterTimeout) {
    clearTimeout(filterTimeout);
  }
});

const qualityStyles = `
.quality-breakdown-container {
  max-width: 120px;
  margin: 0 auto;
}

.quality-breakdown-bar {
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
}

.quality-segment {
  height: 100%;
  transition: width 0.3s ease;
  position: relative;
}

.quality-segment.good {
  background: linear-gradient(45deg, #4CAF50, #66BB6A);
}

.quality-segment.damaged {
  background: linear-gradient(45deg, #FF9800, #FFB74D);
}

.quality-segment.reject {
  background: linear-gradient(45deg, #F44336, #EF5350);
}

.quality-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

.quality-indicator.good {
  background: #4CAF50;
}

.quality-indicator.damaged {
  background: #FF9800;
}

.quality-indicator.reject {
  background: #F44336;
}
`;

// Inject styles
const style = document.createElement("style");
style.textContent = qualityStyles;
document.head.appendChild(style);
</script>
