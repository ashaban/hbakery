<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-receipt-text</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Sales Dashboard
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Comprehensive overview of sales performance and analytics
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-btn
              color="primary"
              size="large"
              variant="outlined"
              @click="refreshData"
            >
              <v-icon start>mdi-refresh</v-icon>
              Refresh
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- KPI CARDS -->
    <v-row class="mb-6">
      <v-col cols="12" md="3" sm="6">
        <v-card class="kpi-card" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-h4 font-weight-bold text-primary">
                  {{ formatCurrency(kpiData.totalRevenue) }}
                </div>
                <div class="text-caption text-grey">Total Revenue</div>
              </div>
              <v-avatar color="primary-lighten-5" size="48">
                <v-icon color="primary">mdi-cash-multiple</v-icon>
              </v-avatar>
            </div>
            <v-chip
              class="mt-2"
              :color="kpiData.revenueGrowth >= 0 ? 'green' : 'red'"
              size="small"
              variant="tonal"
            >
              <v-icon start>{{
                kpiData.revenueGrowth >= 0
                  ? "mdi-trending-up"
                  : "mdi-trending-down"
              }}</v-icon>
              {{ Math.abs(kpiData.revenueGrowth) }}%
              {{ kpiData.revenueGrowth >= 0 ? "growth" : "decline" }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3" sm="6">
        <v-card class="kpi-card" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-h4 font-weight-bold text-green">
                  {{ kpiData.totalSales.toLocaleString() }}
                </div>
                <div class="text-caption text-grey">Total Sales</div>
              </div>
              <v-avatar color="green-lighten-5" size="48">
                <v-icon color="green">mdi-shopping</v-icon>
              </v-avatar>
            </div>
            <v-chip
              class="mt-2"
              :color="kpiData.salesGrowth >= 0 ? 'green' : 'red'"
              size="small"
              variant="tonal"
            >
              <v-icon start>{{
                kpiData.salesGrowth >= 0
                  ? "mdi-chart-line"
                  : "mdi-chart-line-variant"
              }}</v-icon>
              {{ Math.abs(kpiData.salesGrowth) }}%
              {{ kpiData.salesGrowth >= 0 ? "growth" : "decline" }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3" sm="6">
        <v-card class="kpi-card" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-h4 font-weight-bold text-orange">
                  {{ formatCurrency(kpiData.outstandingBalance) }}
                </div>
                <div class="text-caption text-grey">Outstanding Balance</div>
              </div>
              <v-avatar color="orange-lighten-5" size="48">
                <v-icon color="orange">mdi-account-cash</v-icon>
              </v-avatar>
            </div>
            <v-chip class="mt-2" color="orange" size="small" variant="tonal">
              {{ kpiData.pendingPayments }} pending payments
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3" sm="6">
        <v-card class="kpi-card" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-h4 font-weight-bold text-purple">
                  {{ formatCurrency(kpiData.averageOrderValue) }}
                </div>
                <div class="text-caption text-grey">Avg Order Value</div>
              </div>
              <v-avatar color="purple-lighten-5" size="48">
                <v-icon color="purple">mdi-chart-bar</v-icon>
              </v-avatar>
            </div>
            <v-chip class="mt-2" color="purple" size="small" variant="tonal">
              {{ kpiData.itemsPerSale }} items/sale
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- FILTERS -->
    <v-card class="mb-6" elevation="1">
      <v-card-text class="pa-4">
        <v-row align="center" dense>
          <v-col cols="12" sm="3">
            <v-select
              v-model="filters.outlet_id"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="outlets"
              label="Outlet"
              multiple
              prepend-inner-icon="mdi-store"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-text-field
              v-model="filters.start_date"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="Start Date"
              prepend-inner-icon="mdi-calendar"
              spellcheck="false"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-text-field
              v-model="filters.end_date"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="End Date"
              prepend-inner-icon="mdi-calendar"
              spellcheck="false"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.payment_status"
              clearable
              density="comfortable"
              :items="[
                { title: 'All', value: '' },
                { title: 'Fully Paid', value: 'PAID' },
                { title: 'Part Paid', value: 'PART' },
              ]"
              label="Payment Status"
              prepend-inner-icon="mdi-filter"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.time_range"
              density="comfortable"
              :items="timeRanges"
              label="Time Range"
              prepend-inner-icon="mdi-clock"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex justify-end" cols="12" sm="12">
            <v-btn
              class="mr-2"
              color="primary"
              variant="flat"
              @click="loadDashboardData"
            >
              <v-icon start>mdi-magnify</v-icon>
              Search
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- CHARTS SECTION -->
    <v-row class="mb-6">
      <!-- Revenue Trend Chart -->
      <v-col cols="12" lg="8">
        <v-card class="chart-card" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-chart-line</v-icon>
            Revenue Trend
            <v-spacer />
            <v-btn
              color="primary"
              size="small"
              variant="text"
              @click="exportChart('revenueChart')"
            >
              <v-icon start>mdi-download</v-icon>
              Export
            </v-btn>
          </v-card-title>
          <v-card-text class="pa-2">
            <div ref="revenueChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Sales by Outlet -->
      <v-col cols="12" lg="4">
        <v-card class="chart-card" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="green">mdi-chart-pie</v-icon>
            Sales by Outlet
          </v-card-title>
          <v-card-text class="pa-2">
            <div ref="outletChart" style="height: 400px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mb-6">
      <!-- Payment Status -->
      <v-col cols="12" md="6">
        <v-card class="chart-card" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="orange">mdi-account-cash</v-icon>
            Payment Status
          </v-card-title>
          <v-card-text class="pa-2">
            <div ref="paymentChart" style="height: 300px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Top Products -->
      <v-col cols="12" md="6">
        <v-card class="chart-card" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="purple">mdi-trophy</v-icon>
            Top Products
          </v-card-title>
          <v-card-text class="pa-2">
            <div ref="productsChart" style="height: 300px; width: 100%" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- SALES TABLE -->
    <v-card class="rounded-lg" elevation="2">
      <v-progress-linear
        :active="loading"
        color="primary"
        height="4"
        :indeterminate="loading"
      />
      <v-data-table-server
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        class="elevation-0"
        :headers="headers"
        :items="sales"
        :items-length="totalRecords"
        :items-per-page-options="[5, 10, 20, 50, 100]"
        :loading="loading"
        loading-text="Loading sales..."
        no-data-text="No sales found"
        @update:options="loadSales"
      >
        <template #top>
          <v-card-title class="d-flex align-center pt-4">
            <v-icon class="mr-2" color="primary"
              >mdi-format-list-bulleted</v-icon
            >
            Recent Sales
            <v-chip class="ml-3" color="primary" size="small" variant="flat">
              {{ sales.length }} total
            </v-chip>
          </v-card-title>
          <v-divider />
        </template>

        <template #item.sale_date="{ item }">
          <div class="d-flex align-center">
            <v-icon class="mr-2" color="grey" size="16">mdi-calendar</v-icon>
            <span class="font-weight-medium">{{
              formatDate(item.sale_date)
            }}</span>
          </div>
        </template>

        <template #item.outlet="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              class="mr-2"
              :color="getOutletColor(item.outlet_type)"
              size="28"
            >
              <v-icon color="white" size="14">{{
                getOutletIcon(item.outlet_type)
              }}</v-icon>
            </v-avatar>
            <div class="font-weight-medium">{{ item.outlet }}</div>
          </div>
        </template>

        <template #item.customer_name="{ item }">
          <v-chip
            :color="item.customer_name ? 'primary' : 'grey'"
            size="small"
            variant="flat"
          >
            {{ item.customer_name || "Walk-in" }}
          </v-chip>
        </template>

        <template #item.total_qty="{ item }">
          <v-chip color="green" size="small" variant="flat">{{
            item.total_qty
          }}</v-chip>
        </template>

        <template #item.total_amount="{ item }">
          <div class="text-right font-weight-bold">
            {{ money(item.total_amount) }}
          </div>
        </template>

        <template #item.paid_amount="{ item }">
          <div class="text-right">{{ money(item.paid_amount) }}</div>
        </template>

        <template #item.balance="{ item }">
          <div
            :class="[
              'text-right',
              Number(item.balance) > 0 ? 'text-error' : 'text-success',
            ]"
          >
            {{ money(item.balance) }}
          </div>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  color="info"
                  icon
                  size="small"
                  variant="text"
                  @click="openViewDialog(item)"
                >
                  <v-icon>mdi-eye-outline</v-icon>
                </v-btn>
              </template>
              <span>View Details</span>
            </v-tooltip>
          </div>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- VIEW DIALOG -->
    <v-dialog
      v-model="showViewDialog"
      max-width="900"
      scrollable
      transition="dialog-bottom-transition"
    >
      <v-card class="rounded-lg">
        <v-toolbar color="info" density="comfortable">
          <v-avatar class="mr-3" color="info" size="40">
            <v-icon color="white">mdi-eye</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold"
            >Sale Details</v-toolbar-title
          >
          <v-spacer />
          <v-btn icon @click="showViewDialog = false"
            ><v-icon>mdi-close</v-icon></v-btn
          >
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-card class="mb-6 elevation-2">
            <v-card-text class="pa-4">
              <v-row>
                <v-col class="border-e" cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar class="mr-3" color="primary" size="48">
                      <v-icon color="white">mdi-identifier</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">SALE ID</div>
                      <div class="text-h5 font-weight-bold">
                        #{{ currentSale?.id }}
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-icon class="mr-3" color="grey">mdi-calendar</v-icon>
                    <div>
                      <div class="text-caption text-grey">DATE</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ formatDate(currentSale?.sale_date) }}
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar
                      class="mr-3"
                      :color="getOutletColor(currentSale?.outlet_type)"
                      size="48"
                    >
                      <v-icon color="white">{{
                        getOutletIcon(currentSale?.outlet_type)
                      }}</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">OUTLET</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ currentSale?.outlet_name }}
                      </div>
                      <v-chip
                        class="mt-1"
                        :color="getOutletColor(currentSale?.outlet_type)"
                        size="small"
                      >
                        {{ currentSale?.outlet_type }}
                      </v-chip>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-icon class="mr-3" color="grey">mdi-account</v-icon>
                    <div>
                      <div class="text-caption text-grey">CUSTOMER</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ currentSale?.customer_name || "Walk-in" }}
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col v-if="currentSale?.notes" cols="12">
                  <v-divider class="my-3" />
                  <div class="text-caption text-grey mb-1">NOTES</div>
                  <v-card variant="outlined">
                    <v-card-text class="pa-3">{{
                      currentSale?.notes
                    }}</v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <v-card class="mb-6 elevation-2">
            <v-card-title class="d-flex align-center bg-teal-lighten-5">
              <v-icon class="mr-2" color="teal">mdi-package-variant</v-icon>
              Items
            </v-card-title>
            <v-card-text class="pa-0">
              <v-table density="comfortable">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="text-left font-weight-bold text-grey">
                      PRODUCT
                    </th>
                    <th class="text-center font-weight-bold text-grey">
                      QUALITY
                    </th>
                    <th class="text-center font-weight-bold text-grey">QTY</th>
                    <th class="text-right font-weight-bold text-grey">
                      UNIT PRICE
                    </th>
                    <th class="text-right font-weight-bold text-grey">
                      TOTAL PRICE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="li in currentItems" :key="li.id">
                    <td class="text-left">{{ li.product_name }}</td>
                    <td class="text-center">
                      <v-chip
                        :color="getQualityColor(li.quality)"
                        size="small"
                        variant="flat"
                      >
                        {{ li.quality }}
                      </v-chip>
                    </td>
                    <td class="text-center">{{ parseFloat(li.quantity) }}</td>
                    <td class="text-right">{{ money(li.unit_price) }}</td>
                    <td class="text-right">
                      {{ money(li.quantity * li.unit_price) }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <div class="text-right pa-4">
                <div class="mb-1">
                  Paid:
                  <strong>{{ money(currentSale?.total_paid || 0) }}</strong>
                </div>
                <div class="text-h6">
                  Total:
                  <strong>{{ money(currentSale?.total_amount || 0) }}</strong>
                </div>
                <div
                  :class="[
                    'mt-1',
                    (currentSale?.total_amount || 0) -
                      (currentSale?.total_paid || 0) >
                    0
                      ? 'text-error'
                      : 'text-success',
                  ]"
                >
                  Balance:
                  <strong>{{
                    money(
                      (currentSale?.total_amount || 0) -
                        (currentSale?.total_paid || 0),
                    )
                  }}</strong>
                </div>
              </div>
            </v-card-text>
          </v-card>

          <!-- Payments Section -->
          <v-card v-if="currentPayments.length > 0" class="elevation-2">
            <v-card-title class="d-flex align-center bg-blue-lighten-5">
              <v-icon class="mr-2" color="blue">mdi-cash-multiple</v-icon>
              Payments
            </v-card-title>
            <v-card-text class="pa-0">
              <v-table density="comfortable">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="text-left font-weight-bold text-grey">DATE</th>
                    <th class="text-left font-weight-bold text-grey">METHOD</th>
                    <th class="text-left font-weight-bold text-grey">
                      REFERENCE
                    </th>
                    <th class="text-right font-weight-bold text-grey">
                      AMOUNT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="payment in currentPayments" :key="payment.id">
                    <td class="text-left">
                      {{ formatDate(payment.payment_date) }}
                    </td>
                    <td class="text-left">
                      <v-chip size="small" variant="outlined">
                        {{ payment.method }}
                      </v-chip>
                    </td>
                    <td class="text-left">{{ payment.reference || "N/A" }}</td>
                    <td class="text-right font-weight-bold">
                      {{ money(payment.amount) }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            color="primary"
            size="large"
            variant="flat"
            @click="showViewDialog = false"
          >
            <v-icon start>mdi-close</v-icon>
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
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

// State
const itemsPerPage = ref(10);
const loading = ref(false);
const sales = ref([]);
const outlets = ref([]);
const page = ref(1);
const totalRecords = ref(0);

// Chart references
const revenueChart = ref(null);
const outletChart = ref(null);
const paymentChart = ref(null);
const productsChart = ref(null);

// Chart instances
let revenueChartInstance = null;
let outletChartInstance = null;
let paymentChartInstance = null;
let productsChartInstance = null;

// Dashboard data
const dashboardData = ref({
  revenueTrend: [],
  outletSales: [],
  paymentStatus: [],
  topProducts: [],
});

const kpiData = ref({
  totalRevenue: 0,
  totalSales: 0,
  outstandingBalance: 0,
  averageOrderValue: 0,
  revenueGrowth: 0,
  salesGrowth: 0,
  pendingPayments: 0,
  itemsPerSale: 0,
});

// View dialog state
const showViewDialog = ref(false);
const currentSale = ref(null);
const currentItems = ref([]);
const currentPayments = ref([]);

// Filters
const filters = reactive({
  outlet_id: [],
  start_date: "",
  end_date: "",
  payment_status: "",
  time_range: "30d",
});

const timeRanges = [
  { title: "Last 7 Days", value: "7d" },
  { title: "Last 30 Days", value: "30d" },
  { title: "Last 90 Days", value: "90d" },
  { title: "This Year", value: "year" },
  { title: "Custom", value: "custom" },
];

// Table headers (read-only)
const headers = [
  { title: "ID", key: "id", sortable: true },
  { title: "Date", key: "sale_date", sortable: true },
  { title: "Outlet", key: "outlet", sortable: true },
  { title: "Customer", key: "customer_name", sortable: true },
  { title: "Items", key: "items_count", align: "center", sortable: true },
  { title: "Qty", key: "total_qty", align: "center", sortable: true },
  { title: "Total", key: "total_amount", align: "end", sortable: true },
  { title: "Paid", key: "paid_amount", align: "end", sortable: true },
  { title: "Balance", key: "balance", align: "end", sortable: true },
  { title: "Actions", key: "actions", sortable: false, align: "end" },
];

// Helper functions
function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getOutletIcon(type) {
  const icons = { MAIN: "mdi-home", SHOP: "mdi-store", CAR: "mdi-truck" };
  return icons[type] || "mdi-store";
}

function getOutletColor(type) {
  const colors = { MAIN: "primary", SHOP: "success", CAR: "warning" };
  return colors[type] || "grey";
}

function getQualityColor(q) {
  const colors = { GOOD: "success", DAMAGED: "warning", REJECT: "error" };
  return colors[q] || "grey";
}

// Dashboard methods
function refreshData() {
  loadDashboardData();
  loadSales();
}

async function loadDashboardData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();

    // Add filters
    if (filters.outlet_id?.length) {
      filters.outlet_id.forEach((id) => params.append("outlet_id[]", id));
    } else if (store.state.auth.outlets.length) {
      store.state.auth.outlets.forEach((outlet) =>
        params.append("outlet_id[]", outlet.outlet_id),
      );
    }
    if (filters.start_date) params.append("start_date", filters.start_date);
    if (filters.end_date) params.append("end_date", filters.end_date);
    if (filters.payment_status)
      params.append("payment_status", filters.payment_status);
    if (filters.time_range && filters.time_range !== "custom") {
      params.append("time_range", filters.time_range);
    }

    const [analyticsRes] = await Promise.all([
      fetch(`/sales/salesanalytics/analytics?${params}`),
    ]);

    const analyticsData = await analyticsRes.json();

    dashboardData.value = analyticsData.dashboard || {};
    kpiData.value = analyticsData.kpi || {};

    // Initialize charts after data is loaded
    nextTick(() => {
      initCharts();
    });
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
  } finally {
    loading.value = false;
  }
}

async function loadSales() {
  loading.value = true;
  const params = new URLSearchParams({
    page: page.value,
    limit: itemsPerPage.value,
  });
  if (filters.outlet_id?.length) {
    filters.outlet_id.forEach((id) => params.append("outlet_id[]", id));
  } else if (store.state.auth.outlets.length) {
    store.state.auth.outlets.forEach((outlet) =>
      params.append("outlet_id[]", outlet.outlet_id),
    );
  }
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);
  if (filters.payment_status)
    params.append("payment_status", filters.payment_status);

  try {
    const res = await fetch(`/sales/salesanalytics?${params}`);
    const data = await res.json();
    sales.value = data.data || [];
    totalRecords.value = data.totalCount || 0;
  } catch (e) {
  } finally {
    loading.value = false;
  }
}

// Chart methods
function initCharts() {
  // Initialize revenue trend chart
  if (revenueChart.value) {
    revenueChartInstance = echarts.init(revenueChart.value);
    revenueChartInstance.setOption(getRevenueChartOption());
  }

  // Initialize outlet sales chart
  if (outletChart.value) {
    outletChartInstance = echarts.init(outletChart.value);
    outletChartInstance.setOption(getOutletChartOption());
  }

  // Initialize payment status chart
  if (paymentChart.value) {
    paymentChartInstance = echarts.init(paymentChart.value);
    paymentChartInstance.setOption(getPaymentChartOption());
  }

  // Initialize top products chart
  if (productsChart.value) {
    productsChartInstance = echarts.init(productsChart.value);
    productsChartInstance.setOption(getProductsChartOption());
  }

  // Add resize listener
  window.addEventListener("resize", handleResize);
}

function handleResize() {
  revenueChartInstance?.resize();
  outletChartInstance?.resize();
  paymentChartInstance?.resize();
  productsChartInstance?.resize();
}

function getRevenueChartOption() {
  const data = dashboardData.value.revenueTrend || [];
  return {
    tooltip: {
      trigger: "axis",
      formatter(params) {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((param) => {
          if (param.seriesName === "Revenue") {
            result += `${param.marker} ${param.seriesName}: $${param.value.toLocaleString()}<br/>`;
          } else {
            result += `${param.marker} ${param.seriesName}: ${param.value}<br/>`;
          }
        });
        return result;
      },
    },
    legend: {
      data: ["Revenue", "Sales Count"],
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
      type: "category",
      data: data.map((item) => {
        const date = new Date(item.date);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }),
    },
    yAxis: [
      {
        type: "value",
        name: "Revenue",
        axisLabel: {
          formatter: "${value}",
        },
      },
      {
        type: "value",
        name: "Sales Count",
        position: "right",
      },
    ],
    series: [
      {
        name: "Revenue",
        type: "line",
        data: data.map((item) => item.revenue),
        smooth: true,
        lineStyle: {
          width: 3,
        },
        itemStyle: {
          color: "#1976d2",
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(25, 118, 210, 0.3)" },
            { offset: 1, color: "rgba(25, 118, 210, 0.1)" },
          ]),
        },
      },
      {
        name: "Sales Count",
        type: "bar",
        yAxisIndex: 1,
        data: data.map((item) => item.sales_count),
        itemStyle: {
          color: "#4caf50",
        },
      },
    ],
  };
}

function getOutletChartOption() {
  const data = dashboardData.value.outletSales || [];
  return {
    tooltip: {
      trigger: "item",
      formatter: "{a} <br/>{b}: ${c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      left: "left",
      top: "center",
    },
    series: [
      {
        name: "Sales by Outlet",
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
        data: data.map((item) => ({
          value: item.revenue,
          name: item.outlet_name,
        })),
      },
    ],
  };
}

function getPaymentChartOption() {
  const data = dashboardData.value.paymentStatus || [];
  return {
    tooltip: {
      trigger: "item",
      formatter: "{a} <br/>{b}: {c} sales ({d}%)",
    },
    legend: {
      bottom: "0%",
      left: "center",
    },
    series: [
      {
        name: "Payment Status",
        type: "pie",
        radius: "50%",
        data: [
          {
            value: data.find((item) => item.status === "PAID")?.count || 0,
            name: "Fully Paid",
            itemStyle: { color: "#4caf50" },
          },
          {
            value: data.find((item) => item.status === "PART")?.count || 0,
            name: "Part Paid",
            itemStyle: { color: "#ff9800" },
          },
          {
            value: data.find((item) => item.status === "PENDING")?.count || 0,
            name: "Pending",
            itemStyle: { color: "#f44336" },
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
}

function getProductsChartOption() {
  const data = dashboardData.value.topProducts || [];
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter(params) {
        return `${params[0].name}<br/>${params[0].marker} Revenue: $${params[0].value.toLocaleString()}`;
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      axisLabel: {
        formatter: "${value}",
      },
    },
    yAxis: {
      type: "category",
      data: data.map((item) => item.product_name),
    },
    series: [
      {
        name: "Revenue",
        type: "bar",
        data: data.map((item) => item.revenue),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: "#83bff6" },
            { offset: 0.5, color: "#188df0" },
            { offset: 1, color: "#188df0" },
          ]),
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: "#2378f7" },
              { offset: 0.7, color: "#2378f7" },
              { offset: 1, color: "#83bff6" },
            ]),
          },
        },
      },
    ],
  };
}

function exportChart(chartType) {
  let chartInstance;
  switch (chartType) {
    case "revenueChart":
      chartInstance = revenueChartInstance;
      break;
    case "outletChart":
      chartInstance = outletChartInstance;
      break;
    case "paymentChart":
      chartInstance = paymentChartInstance;
      break;
    case "productsChart":
      chartInstance = productsChartInstance;
      break;
  }

  if (chartInstance) {
    const chartDataURL = chartInstance.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#fff",
    });

    const link = document.createElement("a");
    link.href = chartDataURL;
    link.download = `${chartType}_${new Date().toISOString().split("T")[0]}.png`;
    link.click();
  }
}

// View dialog methods
async function openViewDialog(row) {
  loading.value = true;
  try {
    const res = await fetch(`/sales/salesanalytics/${row.id}`);
    const data = await res.json();

    currentSale.value = {
      ...data.sale,
      outlet: data.sale.outlet_name,
      outlet_type: data.sale.outlet_type,
    };
    currentItems.value = data.items || [];
    currentPayments.value = data.payments || [];

    showViewDialog.value = true;
  } catch (e) {
  } finally {
    loading.value = false;
  }
}

// Initialization
async function loadInitialData() {
  try {
    const outletsParams = new URLSearchParams({ limit: 1000 });
    if (store.state.auth.outlets.length) {
      store.state.auth.outlets.forEach((outlet) =>
        outletsParams.append("id[]", outlet.outlet_id),
      );
    }
    const outRes = await fetch(`/outlets?${outletsParams}`);
    outlets.value = (await outRes.json()).data || [];
  } catch (e) {
    console.error("Outlets load failed:", e);
  }
}

onMounted(() => {
  loadDashboardData();
  loadSales();
  loadInitialData();
});

onUnmounted(() => {
  // Clean up chart instances
  revenueChartInstance?.dispose();
  outletChartInstance?.dispose();
  paymentChartInstance?.dispose();
  productsChartInstance?.dispose();

  // Remove resize listener
  window.removeEventListener("resize", handleResize);
});

// Watch for filter changes
watch(
  () => [
    filters.outlet_id,
    filters.start_date,
    filters.end_date,
    filters.payment_status,
    filters.time_range,
  ],
  () => {
    loadDashboardData();
    loadSales();
  },
  { deep: true },
);
</script>

<style scoped>
.kpi-card {
  cursor: pointer;
  transition: all 0.3s ease;
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.chart-card {
  transition: all 0.3s ease;
}

.chart-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
}

.border-e {
  border-right: 1px solid #e0e0e0;
}

.v-card {
  transition: all 0.3s ease;
}

.v-btn {
  transition: all 0.2s ease;
}

.text-right {
  text-align: right;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .kpi-card {
    margin-bottom: 16px;
  }
}
</style>
