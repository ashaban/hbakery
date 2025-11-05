<template>
  <v-container class="dashboard-container" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h4 font-weight-bold text-primary mb-2">
              Bakery Dashboard
            </h1>
            <p class="text-body-1 text-grey">
              Comprehensive overview of sales, expenditures, and production
              performance
            </p>
          </div>
          <v-btn
            class="px-6"
            color="primary"
            elevation="2"
            size="large"
            @click="exportDashboard"
          >
            <v-icon size="20" start>mdi-file-export</v-icon>
            Export Report
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- FILTERS -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-4">
          <v-icon class="mr-2" color="primary">mdi-filter</v-icon>
          <h3 class="text-h6 font-weight-medium">Dashboard Filters</h3>
        </div>

        <v-row dense>
          <!-- Date Range -->
          <v-col cols="12" md="3">
            <v-card border class="rounded-lg" variant="outlined">
              <v-card-text class="pa-3">
                <div class="d-flex align-center mb-2">
                  <v-icon class="mr-2" color="green" size="18"
                    >mdi-calendar</v-icon
                  >
                  <label class="text-caption font-weight-medium text-primary"
                    >Start Date</label
                  >
                </div>
                <VueDatePicker
                  v-model="filters.start_date"
                  auto-apply
                  format="yyyy-MM-dd"
                  model-type="format"
                  placeholder="Start Date"
                  :teleport="true"
                />
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="3">
            <v-card border class="rounded-lg" variant="outlined">
              <v-card-text class="pa-3">
                <div class="d-flex align-center mb-2">
                  <v-icon class="mr-2" color="red" size="18"
                    >mdi-calendar</v-icon
                  >
                  <label class="text-caption font-weight-medium text-primary"
                    >End Date</label
                  >
                </div>
                <VueDatePicker
                  v-model="filters.end_date"
                  auto-apply
                  format="yyyy-MM-dd"
                  model-type="format"
                  placeholder="End Date"
                  :teleport="true"
                />
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Product Filter -->
          <v-col cols="12" md="3">
            <v-card border class="rounded-lg" variant="outlined">
              <v-card-text class="pa-3">
                <div class="d-flex align-center mb-2">
                  <v-icon class="mr-2" color="blue" size="18"
                    >mdi-package-variant</v-icon
                  >
                  <label class="text-caption font-weight-medium text-primary"
                    >Product</label
                  >
                </div>
                <v-autocomplete
                  v-model="filters.product_id"
                  clearable
                  color="primary"
                  density="compact"
                  hide-details
                  item-title="name"
                  item-value="id"
                  :items="products"
                  placeholder="All Products"
                  variant="underlined"
                />
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Outlet Filter -->
          <v-col cols="12" md="3">
            <v-card border class="rounded-lg" variant="outlined">
              <v-card-text class="pa-3">
                <div class="d-flex align-center mb-2">
                  <v-icon class="mr-2" color="purple" size="18"
                    >mdi-store</v-icon
                  >
                  <label class="text-caption font-weight-medium text-primary"
                    >Outlet</label
                  >
                </div>
                <v-autocomplete
                  v-model="filters.outlet_id"
                  clearable
                  color="primary"
                  density="compact"
                  hide-details
                  item-title="name"
                  item-value="id"
                  :items="outlets"
                  placeholder="All Outlets"
                  variant="underlined"
                />
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- Action Buttons -->
        <v-divider class="my-4" />
        <div class="d-flex justify-space-between align-center">
          <div class="text-caption text-grey">
            <v-icon class="mr-1" size="14">mdi-information</v-icon>
            Apply filters to update dashboard data
          </div>
          <div class="d-flex gap-2">
            <v-btn
              class="px-4"
              color="grey"
              size="small"
              variant="outlined"
              @click="resetFilters"
            >
              <v-icon size="18" start>mdi-refresh</v-icon>
              Reset
            </v-btn>
            <v-btn
              class="px-4"
              color="primary"
              elevation="2"
              :loading="loading"
              size="small"
              @click="loadDashboardData"
            >
              <v-icon size="18" start>mdi-chart-bar</v-icon>
              Apply Filters
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- KPI CARDS -->
    <v-row class="mb-6">
      <v-col cols="12" md="3" sm="6">
        <v-card border class="kpi-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="green-lighten-5" size="48">
                <v-icon color="green" size="24">mdi-cash</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-green">
                  {{ formatCurrency(salesData.total_sales_amount || 0) }}
                </div>
                <div class="text-caption text-grey">Total Sales</div>
                <div class="text-caption text-green">
                  {{ formatCurrency(salesData.total_paid_amount || 0) }} Paid
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3" sm="6">
        <v-card border class="kpi-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="red-lighten-5" size="48">
                <v-icon color="red" size="24">mdi-cash-remove</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-red">
                  {{ formatCurrency(expenditureData.totalExpenditure || 0) }}
                </div>
                <div class="text-caption text-grey">Total Expenditure</div>
                <div class="text-caption text-red">
                  {{ expenditureData.data?.length || 0 }} Categories
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3" sm="6">
        <v-card border class="kpi-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="blue-lighten-5" size="48">
                <v-icon color="blue" size="24">mdi-factory</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-blue">
                  {{ formatCurrency(productionData.totalIngredientCost || 0) }}
                </div>
                <div class="text-caption text-grey">Production Cost</div>
                <div class="text-caption text-blue">
                  {{ productionData.data?.length || 0 }} Ingredients
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3" sm="6">
        <v-card border class="kpi-card" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <div class="d-flex align-center">
              <v-avatar class="mr-3" color="orange-lighten-5" size="48">
                <v-icon color="orange" size="24">mdi-chart-line</v-icon>
              </v-avatar>
              <div>
                <div class="text-h5 font-weight-bold text-orange">
                  {{ formatCurrency(profitMargin) }}
                </div>
                <div class="text-caption text-grey">Profit Margin</div>
                <div class="text-caption text-orange">
                  {{ profitMarginPercentage }}%
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- MAIN CHARTS SECTION -->
    <v-row class="mb-6">
      <!-- Cost vs Revenue Analysis -->
      <v-col cols="12" lg="8">
        <v-card class="rounded-lg" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-2" color="primary">mdi-chart-bar</v-icon>
              <h4 class="text-h6 font-weight-medium">
                Cost vs Revenue Analysis
              </h4>
            </div>
            <v-chart
              v-if="!loading && hasData"
              :option="costRevenueOption"
              style="height: 400px; width: 100%"
            />
            <div v-else-if="loading" class="text-center py-8">
              <v-progress-circular color="primary" indeterminate />
              <div class="mt-2 text-caption text-grey">
                Loading chart data...
              </div>
            </div>
            <div v-else class="text-center py-8 text-grey">
              No data available for the selected period
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Profit Margin Gauge -->
      <v-col cols="12" lg="4">
        <v-card class="rounded-lg" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-2" color="orange">mdi-gauge</v-icon>
              <h4 class="text-h6 font-weight-medium">Profit Margin</h4>
            </div>
            <v-chart
              v-if="!loading && hasData"
              :option="profitGaugeOption"
              style="height: 400px; width: 100%"
            />
            <div v-else-if="loading" class="text-center py-8">
              <v-progress-circular color="orange" indeterminate />
              <div class="mt-2 text-caption text-grey">
                Loading chart data...
              </div>
            </div>
            <div v-else class="text-center py-8 text-grey">
              No data available for the selected period
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- SECONDARY CHARTS SECTION -->
    <v-row class="mb-6">
      <!-- Expenditure Breakdown -->
      <v-col cols="12" lg="6">
        <v-card class="rounded-lg" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-2" color="red">mdi-chart-pie</v-icon>
              <h4 class="text-h6 font-weight-medium">Expenditure Breakdown</h4>
            </div>
            <v-chart
              v-if="!loading && hasExpenditureData"
              :option="expenditureOption"
              style="height: 400px; width: 100%"
            />
            <div v-else-if="loading" class="text-center py-8">
              <v-progress-circular color="red" indeterminate />
              <div class="mt-2 text-caption text-grey">
                Loading chart data...
              </div>
            </div>
            <div v-else class="text-center py-8 text-grey">
              No expenditure data available
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Sales by Product -->
      <v-col cols="12" lg="6">
        <v-card class="rounded-lg" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-2" color="green">mdi-chart-bar</v-icon>
              <h4 class="text-h6 font-weight-medium">Top Selling Products</h4>
            </div>
            <v-chart
              v-if="!loading && hasSalesData"
              :option="salesByProductOption"
              style="height: 400px; width: 100%"
            />
            <div v-else-if="loading" class="text-center py-8">
              <v-progress-circular color="green" indeterminate />
              <div class="mt-2 text-caption text-grey">
                Loading chart data...
              </div>
            </div>
            <div v-else class="text-center py-8 text-grey">
              No sales data available
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- DETAILED TABLES SECTION -->
    <v-row class="mb-6">
      <!-- Sales by Product Table -->
      <v-col cols="12" lg="6">
        <v-card class="rounded-lg" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between mb-4">
              <div class="d-flex align-center">
                <v-icon class="mr-2" color="green">mdi-cash-multiple</v-icon>
                <h4 class="text-h6 font-weight-medium">Sales by Product</h4>
              </div>
              <v-chip color="green" size="small" variant="flat">
                {{ salesData.data?.length || 0 }} Products
              </v-chip>
            </div>

            <v-data-table
              density="comfortable"
              :headers="salesHeaders"
              hide-default-footer
              :items="salesData.data || []"
              :loading="loading"
            >
              <template #loading>
                <v-skeleton-loader type="table-row@5" />
              </template>

              <template #item.product_name="{ item }">
                <div class="font-weight-medium">{{ item.product_name }}</div>
              </template>

              <template #item.total_qty="{ item }">
                <v-chip color="blue" size="small" variant="outlined">
                  {{ item.total_qty }}
                </v-chip>
              </template>

              <template #item.total_sales="{ item }">
                <div class="font-weight-medium text-green">
                  {{ formatCurrency(item.total_sales) }}
                </div>
              </template>

              <template #item.total_paid="{ item }">
                <div class="font-weight-medium text-green">
                  {{ formatCurrency(item.total_paid) }}
                </div>
              </template>

              <template #item.payment_rate="{ item }">
                <v-chip
                  :color="getPaymentRateColor(item.payment_rate)"
                  size="small"
                  variant="flat"
                >
                  {{ item.payment_rate }}%
                </v-chip>
              </template>

              <template #no-data>
                <div class="text-center py-4 text-grey">
                  No sales data available for the selected period
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Production Ingredients Cost Table -->
      <v-col cols="12" lg="6">
        <v-card class="rounded-lg" elevation="2">
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between mb-4">
              <div class="d-flex align-center">
                <v-icon class="mr-2" color="blue">mdi-ingredient</v-icon>
                <h4 class="text-h6 font-weight-medium">
                  Production Ingredients Cost
                </h4>
              </div>
              <v-chip color="blue" size="small" variant="flat">
                {{ productionData.data?.length || 0 }} Ingredients
              </v-chip>
            </div>

            <v-data-table
              density="comfortable"
              :headers="productionHeaders"
              hide-default-footer
              :items="productionData.data || []"
              :loading="loading"
            >
              <template #loading>
                <v-skeleton-loader type="table-row@5" />
              </template>

              <template #item.ingredient_name="{ item }">
                <div class="font-weight-medium">{{ item.ingredient_name }}</div>
              </template>

              <template #item.total_consumed="{ item }">
                <v-chip color="blue-grey" size="small" variant="outlined">
                  {{ item.total_consumed }}
                </v-chip>
              </template>

              <template #item.avg_price="{ item }">
                <div class="text-caption">
                  {{ formatCurrency(item.avg_price) }}
                </div>
              </template>

              <template #item.total_cost="{ item }">
                <div class="font-weight-medium text-blue">
                  {{ formatCurrency(item.total_cost) }}
                </div>
              </template>

              <template #no-data>
                <div class="text-center py-4 text-grey">
                  No production data available for the selected period
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- EXPENDITURE DETAILS -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-4">
        <div class="d-flex align-center justify-space-between mb-4">
          <div class="d-flex align-center">
            <v-icon class="mr-2" color="red">mdi-cash-remove</v-icon>
            <h4 class="text-h6 font-weight-medium">Expenditure by Type</h4>
          </div>
          <v-chip color="red" size="small" variant="flat">
            Total: {{ formatCurrency(expenditureData.totalExpenditure || 0) }}
          </v-chip>
        </div>

        <v-data-table
          density="comfortable"
          :headers="expenditureHeaders"
          hide-default-footer
          :items="expenditureData.data || []"
          :loading="loading"
        >
          <template #loading>
            <v-skeleton-loader type="table-row@5" />
          </template>

          <template #item.type_name="{ item }">
            <div class="font-weight-medium">{{ item.type_name }}</div>
          </template>

          <template #item.total_amount="{ item }">
            <div class="font-weight-medium text-red">
              {{ formatCurrency(item.total_amount) }}
            </div>
          </template>

          <template #item.percentage="{ item }">
            <v-progress-linear
              color="red"
              height="8"
              :model-value="item.percentage"
              rounded
            >
              <template #default>
                <span class="text-caption text-white"
                  >{{ item.percentage.toFixed(1) }}%</span
                >
              </template>
            </v-progress-linear>
          </template>

          <template #no-data>
            <div class="text-center py-4 text-grey">
              No expenditure data available for the selected period
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { use } from "echarts/core";
import VChart from "vue-echarts";
import { CanvasRenderer } from "echarts/renderers";
import { BarChart, GaugeChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";

// Register ECharts components
use([
  CanvasRenderer,
  BarChart,
  GaugeChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

// Reactive state
const loading = ref(false);
const products = ref([]);
const outlets = ref([]);

// Data stores
const salesData = ref({});
const expenditureData = ref({});
const productionData = ref({});

// Filters
const filters = ref({
  start_date: new Date()
    .toISOString()
    .split("T")[0]
    .replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-$2-01"),
  end_date: new Date().toISOString().split("T")[0],
  product_id: null,
  outlet_id: null,
});

// Headers for tables
const salesHeaders = [
  { title: "Product", key: "product_name", sortable: true },
  { title: "Quantity", key: "total_qty", sortable: true, align: "center" },
  { title: "Total Sales", key: "total_sales", sortable: true, align: "end" },
  { title: "Paid Amount", key: "total_paid", sortable: true, align: "end" },
  {
    title: "Payment Rate",
    key: "payment_rate",
    sortable: true,
    align: "center",
  },
];

const productionHeaders = [
  { title: "Ingredient", key: "ingredient_name", sortable: true },
  {
    title: "Quantity Used",
    key: "total_consumed",
    sortable: true,
    align: "center",
  },
  { title: "Avg Price", key: "avg_price", sortable: true, align: "end" },
  { title: "Total Cost", key: "total_cost", sortable: true, align: "end" },
];

const expenditureHeaders = [
  { title: "Expenditure Type", key: "type_name", sortable: true },
  { title: "Total Amount", key: "total_amount", sortable: true, align: "end" },
  {
    title: "Percentage",
    key: "percentage",
    sortable: true,
    align: "center",
    width: "200px",
  },
];

// Computed properties
const profitMargin = computed(() => {
  const sales = salesData.value.total_sales_amount || 0;
  const expenditure = expenditureData.value.totalExpenditure || 0;
  const productionCost = productionData.value.totalIngredientCost || 0;
  return sales - expenditure - productionCost;
});

const profitMarginPercentage = computed(() => {
  const sales = salesData.value.total_sales_amount || 0;
  if (sales === 0) return 0;
  return ((profitMargin.value / sales) * 100).toFixed(1);
});

const hasData = computed(() => {
  return (
    salesData.value.total_sales_amount > 0 ||
    expenditureData.value.totalExpenditure > 0 ||
    productionData.value.totalIngredientCost > 0
  );
});

const hasSalesData = computed(() => {
  return salesData.value.data && salesData.value.data.length > 0;
});

const hasExpenditureData = computed(() => {
  return expenditureData.value.data && expenditureData.value.data.length > 0;
});

// Chart Options
const costRevenueOption = computed(() => {
  const salesAmount = salesData.value.total_sales_amount || 0;
  const expenditureAmount = expenditureData.value.totalExpenditure || 0;
  const productionCost = productionData.value.totalIngredientCost || 0;
  const profit = profitMargin.value;

  return {
    title: {
      text: "Financial Performance Overview",
      left: "center",
      textStyle: {
        fontSize: 16,
        fontWeight: "bold",
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        let result = "<b>Financial Overview</b><br/>";
        params.forEach((param) => {
          result += `${param.marker} ${param.seriesName}: ${formatCurrency(param.value)}<br/>`;
        });
        return result;
      },
    },
    legend: {
      data: [
        "Sales Revenue",
        "Total Expenditure",
        "Production Cost",
        "Profit Margin",
      ],
      top: "10%",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      top: "20%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: ["Performance"],
      axisLabel: {
        fontSize: 12,
      },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: (value) => {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
          if (value >= 1000) return (value / 1000).toFixed(0) + "K";
          return value;
        },
      },
    },
    series: [
      {
        name: "Sales Revenue",
        type: "bar",
        data: [salesAmount],
        itemStyle: { color: "#4CAF50" },
        label: {
          show: true,
          position: "top",
          formatter: (params) => formatCurrency(params.value),
        },
      },
      {
        name: "Total Expenditure",
        type: "bar",
        data: [expenditureAmount],
        itemStyle: { color: "#F44336" },
        label: {
          show: true,
          position: "top",
          formatter: (params) => formatCurrency(params.value),
        },
      },
      {
        name: "Production Cost",
        type: "bar",
        data: [productionCost],
        itemStyle: { color: "#2196F3" },
        label: {
          show: true,
          position: "top",
          formatter: (params) => formatCurrency(params.value),
        },
      },
      {
        name: "Profit Margin",
        type: "bar",
        data: [profit],
        itemStyle: {
          color: profit >= 0 ? "#FF9800" : "#FF5722",
        },
        label: {
          show: true,
          position: "top",
          formatter: (params) => formatCurrency(params.value),
        },
      },
    ],
  };
});

const profitGaugeOption = computed(() => {
  const percentage = parseFloat(profitMarginPercentage.value);

  return {
    title: {
      text: "Profit Margin %",
      left: "center",
      top: "10%",
      textStyle: {
        fontSize: 16,
        fontWeight: "bold",
      },
    },
    tooltip: {
      formatter: `Profit Margin: {c}%`,
    },
    series: [
      {
        type: "gauge",
        center: ["50%", "60%"],
        startAngle: 180,
        endAngle: 0,
        min: -50,
        max: 50,
        splitNumber: 10,
        itemStyle: {
          color: percentage >= 0 ? "#FF9800" : "#FF5722",
        },
        progress: {
          show: true,
          width: 30,
        },
        pointer: {
          show: false,
        },
        axisLine: {
          lineStyle: {
            width: 30,
            color: [
              [0.3, "#FF6B6B"],
              [0.7, "#FFE66D"],
              [1, "#4ECDC4"],
            ],
          },
        },
        axisTick: {
          distance: -45,
          splitNumber: 5,
          lineStyle: {
            width: 2,
            color: "#999",
          },
        },
        splitLine: {
          distance: -52,
          length: 14,
          lineStyle: {
            width: 3,
            color: "#999",
          },
        },
        axisLabel: {
          distance: -20,
          color: "#999",
          fontSize: 12,
        },
        anchor: {
          show: false,
        },
        title: {
          show: false,
        },
        detail: {
          valueAnimation: true,
          width: "60%",
          lineHeight: 40,
          borderRadius: 8,
          offsetCenter: [0, "-15%"],
          fontSize: 30,
          fontWeight: "bolder",
          formatter: `{value}%`,
          color: "inherit",
        },
        data: [
          {
            value: percentage,
          },
        ],
      },
    ],
  };
});

const expenditureOption = computed(() => {
  const chartData =
    expenditureData.value.data?.map((item) => ({
      name: item.type_name,
      value: item.total_amount,
    })) || [];

  return {
    title: {
      text: "Expenditure Distribution",
      left: "center",
      textStyle: {
        fontSize: 16,
        fontWeight: "bold",
      },
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        return `
          <b>${params.name}</b><br/>
          ${params.marker} ${formatCurrency(params.value)}<br/>
          ${params.percent}%
        `;
      },
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
      formatter: (name) => {
        const item = expenditureData.value.data?.find(
          (d) => d.type_name === name,
        );
        return item ? `${name}\n${formatCurrency(item.total_amount)}` : name;
      },
      textStyle: {
        fontSize: 10,
      },
    },
    series: [
      {
        name: "Expenditure",
        type: "pie",
        radius: ["40%", "70%"],
        center: ["40%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
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
            fontSize: "14",
            fontWeight: "bold",
            formatter: (params) => {
              return `${params.name}\n${formatCurrency(params.value)}\n${params.percent}%`;
            },
          },
        },
        labelLine: {
          show: false,
        },
        data: chartData,
      },
    ],
  };
});

const salesByProductOption = computed(() => {
  const sortedProducts =
    salesData.value.data
      ?.slice()
      .sort((a, b) => b.total_sales - a.total_sales)
      .slice(0, 8) || [];

  return {
    title: {
      text: "Top Selling Products",
      left: "center",
      textStyle: {
        fontSize: 16,
        fontWeight: "bold",
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) => {
        const param = params[0];
        const product = sortedProducts[param.dataIndex];
        return `
          <b>${product.product_name}</b><br/>
          Sales: ${formatCurrency(product.total_sales)}<br/>
          Quantity: ${product.total_qty}<br/>
          Paid: ${formatCurrency(product.total_paid)}<br/>
          Payment Rate: ${product.payment_rate}%
        `;
      },
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
      axisLabel: {
        formatter: (value) => {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
          if (value >= 1000) return (value / 1000).toFixed(0) + "K";
          return value;
        },
      },
    },
    yAxis: {
      type: "category",
      data: sortedProducts.map((p) => p.product_name),
      axisLabel: {
        fontSize: 10,
      },
    },
    series: [
      {
        name: "Sales Amount",
        type: "bar",
        data: sortedProducts.map((p) => p.total_sales),
        itemStyle: {
          color: "#4CAF50",
        },
        label: {
          show: true,
          position: "right",
          formatter: (params) => formatCurrency(params.value),
        },
      },
    ],
  };
});

// Methods
function formatCurrency(amount) {
  if (!amount) return "TZS 0";
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPaymentRateColor(rate) {
  if (rate >= 90) return "green";
  if (rate >= 75) return "orange";
  return "red";
}

function resetFilters() {
  filters.value = {
    start_date: new Date()
      .toISOString()
      .split("T")[0]
      .replace(/(\d{4})-(\d{2})-(\d{2})/, "$1-$2-01"),
    end_date: new Date().toISOString().split("T")[0],
    product_id: null,
    outlet_id: null,
  };
  loadDashboardData();
}

async function loadDashboardData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    Object.entries(filters.value).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    // Load all data in parallel
    const [salesRes, expenditureRes, productionRes] = await Promise.all([
      fetch(`/reports/salesByProduct?${params}`),
      fetch(`/reports/expenditureByType?${params}`),
      fetch(`/reports/productionIngredientsCost?${params}`),
    ]);

    if (!salesRes.ok) throw new Error("Sales API failed");
    if (!expenditureRes.ok) throw new Error("Expenditure API failed");
    if (!productionRes.ok) throw new Error("Production API failed");

    salesData.value = await salesRes.json();
    expenditureData.value = await expenditureRes.json();
    productionData.value = await productionRes.json();

    // Calculate percentages for expenditure data
    if (expenditureData.value.data) {
      const total = expenditureData.value.totalExpenditure;
      expenditureData.value.data.forEach((item) => {
        item.percentage = total > 0 ? (item.total_amount / total) * 100 : 0;
      });
    }

    // Calculate payment rates for sales data
    if (salesData.value.data) {
      salesData.value.data.forEach((item) => {
        item.payment_rate =
          item.total_sales > 0
            ? Math.round((item.total_paid / item.total_sales) * 100)
            : 0;
      });
    }
  } catch (error) {
    console.error("Failed to load dashboard data:", error);
  } finally {
    loading.value = false;
  }
}

function exportDashboard() {
  const data = {
    filters: filters.value,
    sales: salesData.value,
    expenditure: expenditureData.value,
    production: productionData.value,
    profitMargin: profitMargin.value,
    profitMarginPercentage: profitMarginPercentage.value,
  };

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(data, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    `dashboard-export-${new Date().toISOString().split("T")[0]}.json`,
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

async function loadReferenceData() {
  try {
    const [productsRes, outletsRes] = await Promise.all([
      fetch("/products?limit=1000"),
      fetch("/outlets?limit=1000"),
    ]);

    if (productsRes.ok) {
      const productsData = await productsRes.json();
      products.value = productsData.data || [];
    }

    if (outletsRes.ok) {
      const outletsData = await outletsRes.json();
      outlets.value = outletsData.data || [];
    }
  } catch (error) {
    console.error("Failed to load reference data:", error);
  }
}

// Lifecycle
onMounted(async () => {
  await loadReferenceData();
  await loadDashboardData();
});

// Watch for filter changes and auto-refresh
watch(
  () => [...Object.values(filters.value)],
  () => {
    // You can implement debounced reload here if needed
  },
  { deep: true },
);
</script>

<style scoped>
.dashboard-container {
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  min-height: 100vh;
}

.kpi-card {
  transition:
    transform 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

:deep(.v-data-table) {
  border-radius: 8px;
}

:deep(.v-btn) {
  text-transform: none;
  font-weight: 500;
}
</style>
