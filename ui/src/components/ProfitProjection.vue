<template>
  <v-container class="report-container" fluid>
    <!-- Header -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4" color="primary" dark>
          <v-card-title class="text-h4 font-weight-bold">
            <v-icon class="mr-3" large>mdi-chart-arc</v-icon>
            Profit Projection Dashboard
          </v-card-title>
        </v-card>
      </v-col>
    </v-row>

    <!-- Summary Cards -->
    <v-row class="mt-4">
      <v-col cols="12" md="2" sm="6">
        <v-card class="profit-card" color="green-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon class="mb-2" color="green-darken-2" size="48"
              >mdi-currency-usd</v-icon
            >
            <div class="text-h5 font-weight-bold text-green-darken-2">
              {{ money(summary.totalRevenue) }}
            </div>
            <div class="text-caption text-grey">Total Revenue</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="2" sm="6">
        <v-card class="cost-card" color="orange-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon class="mb-2" color="orange-darken-2" size="48"
              >mdi-sack</v-icon
            >
            <div class="text-h5 font-weight-bold text-orange-darken-2">
              {{ money(summary.totalIngredientCost) }}
            </div>
            <div class="text-caption text-grey">Ingredient Cost</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="2" sm="6">
        <v-card class="cost-card" color="blue-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon class="mb-2" color="blue-darken-2" size="48"
              >mdi-account-hard-hat</v-icon
            >
            <div class="text-h5 font-weight-bold text-blue-darken-2">
              {{ money(summary.totalLabourCost) }}
            </div>
            <div class="text-caption text-grey">Labour Cost</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="2" sm="6">
        <v-card class="cost-card" color="purple-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon class="mb-2" color="purple-darken-2" size="48"
              >mdi-cash-multiple</v-icon
            >
            <div class="text-h5 font-weight-bold text-purple-darken-2">
              {{ money(summary.totalExpenditure) }}
            </div>
            <div class="text-caption text-grey">Other Expenditures</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="2" sm="6">
        <v-card class="cost-card" color="red-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon class="mb-2" color="red-darken-2" size="48"
              >mdi-calculator</v-icon
            >
            <div class="text-h5 font-weight-bold text-red-darken-2">
              {{ money(summary.totalCost) }}
            </div>
            <div class="text-caption text-grey">Total Cost</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="2" sm="6">
        <v-card
          class="margin-card"
          :color="summary.margin >= 0 ? 'teal-lighten-5' : 'red-lighten-5'"
          elevation="4"
        >
          <v-card-text class="text-center">
            <v-icon
              class="mb-2"
              :color="summary.margin >= 0 ? 'teal-darken-2' : 'red-darken-2'"
              size="48"
            >
              {{
                summary.margin >= 0 ? "mdi-trending-up" : "mdi-trending-down"
              }}
            </v-icon>
            <div
              class="text-h5 font-weight-bold"
              :class="
                summary.margin >= 0 ? 'text-teal-darken-2' : 'text-red-darken-2'
              "
            >
              {{ money(summary.margin) }}
            </div>
            <div class="text-caption text-grey">Profit Margin</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Charts Section -->
    <v-row class="mt-6">
      <!-- Cost Distribution Pie Chart -->
      <v-col cols="12" md="6">
        <v-card class="chart-card" elevation="4">
          <v-card-title class="text-h6">
            <v-icon class="mr-2">mdi-chart-pie</v-icon>
            Cost Distribution
          </v-card-title>
          <v-card-text>
            <v-chart
              :autoresize="true"
              :option="costDistributionChart"
              style="height: 300px"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Profitability Gauge -->
      <v-col cols="12" md="6">
        <v-card class="chart-card" elevation="4">
          <v-card-title class="text-h6">
            <v-icon class="mr-2">mdi-gauge</v-icon>
            Profitability Ratio
          </v-card-title>
          <v-card-text>
            <v-chart
              :autoresize="true"
              :option="profitabilityGauge"
              style="height: 300px"
            />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="12">
        <!-- Filters -->
        <v-card class="mb-6" elevation="2" rounded="lg">
          <v-card-text class="pa-4">
            <v-row dense>
              <!-- Date Range -->
              <v-col cols="12" md="4">
                <div class="mb-1 text-caption text-grey">
                  Production Date Range
                </div>
                <VueDatePicker
                  v-model="dateRange"
                  auto-apply
                  class="rounded-lg border px-4 py-2 w-100"
                  :enable-time-picker="false"
                  placeholder="Select date range"
                  range
                  :teleport="true"
                />
              </v-col>

              <!-- Ingredients -->
              <v-col cols="12" md="3">
                <v-autocomplete
                  v-model="filters.ingredients"
                  chips
                  clearable
                  closable-chips
                  density="comfortable"
                  item-title="name"
                  item-value="id"
                  :items="ingredientOptions"
                  label="Ingredients"
                  multiple
                  prepend-inner-icon="mdi-food-apple"
                  variant="outlined"
                />
              </v-col>

              <!-- Products -->
              <v-col cols="12" md="3">
                <v-autocomplete
                  v-model="filters.products"
                  chips
                  clearable
                  closable-chips
                  density="comfortable"
                  item-title="name"
                  item-value="id"
                  :items="productOptions"
                  label="Products"
                  multiple
                  prepend-inner-icon="mdi-package-variant"
                  variant="outlined"
                />
              </v-col>

              <!-- Team Leader -->
              <v-col cols="12" md="2">
                <v-autocomplete
                  v-model="filters.team_leader"
                  clearable
                  density="comfortable"
                  :hint="
                    filters.team_leader
                      ? 'Filtering by selected leader'
                      : 'Leave empty to include all leaders'
                  "
                  item-title="name"
                  item-value="id"
                  :items="leaderOptions"
                  label="Team Leader"
                  persistent-hint
                  prepend-inner-icon="mdi-account-tie"
                  variant="outlined"
                />
              </v-col>

              <!-- Actions -->
              <v-col class="d-flex justify-end" cols="12">
                <div class="d-flex gap-2">
                  <v-btn color="primary" :loading="loading" @click="loadReport">
                    <v-icon start>mdi-filter</v-icon>
                    Apply Filters
                  </v-btn>
                  <v-btn
                    color="primary"
                    :loading="loading"
                    variant="flat"
                    @click="loadReport"
                  >
                    <v-icon start>mdi-refresh</v-icon>
                    Refresh
                  </v-btn>
                  <v-btn
                    color="grey"
                    :disabled="loading"
                    variant="outlined"
                    @click="resetFilters"
                  >
                    <v-icon start>mdi-broom</v-icon>
                    Reset
                  </v-btn>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Tables -->
        <v-row>
          <!-- Ingredients table -->
          <v-col cols="12" md="4">
            <v-card elevation="2" rounded="lg">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" color="primary">mdi-food-variant</v-icon>
                Ingredients Consumed
                <v-spacer />
                <v-chip color="primary" size="small" variant="tonal">
                  {{ ingredients.length }} item(s)
                </v-chip>
              </v-card-title>

              <v-progress-linear
                :active="loading"
                color="primary"
                height="3"
                :indeterminate="loading"
              />

              <v-data-table
                class="elevation-0"
                density="comfortable"
                :headers="ingredientHeaders"
                hover
                :items="ingredients"
              >
                <template #item.total_consumed="{ item }">
                  {{ num(item.total_consumed) }}
                </template>
                <template #item.avg_price="{ item }">
                  {{ money(item.avg_price) }}
                </template>
                <template #item.total_cost="{ item }">
                  <v-chip color="orange" size="small" variant="flat">
                    {{ money(item.total_cost) }}
                  </v-chip>
                </template>

                <template #no-data>
                  <div class="text-center py-6 text-grey">
                    No ingredients for selected filters.
                  </div>
                </template>
              </v-data-table>
            </v-card>
          </v-col>

          <!-- Expenditures table -->
          <v-col cols="12" md="3">
            <v-card elevation="2" rounded="lg">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" color="purple">mdi-cash-multiple</v-icon>
                Other Expenditures
                <v-spacer />
                <v-chip color="purple" size="small" variant="tonal">
                  {{ expenditures.length }} item(s)
                </v-chip>
              </v-card-title>

              <v-progress-linear
                :active="loading"
                color="purple"
                height="3"
                :indeterminate="loading"
              />

              <v-data-table
                class="elevation-0"
                density="comfortable"
                :headers="expenditureHeaders"
                hover
                :items="expenditures"
              >
                <template #item.amount="{ item }">
                  <v-chip color="purple" size="small" variant="flat">
                    {{ money(item.amount) }}
                  </v-chip>
                </template>
                <template #item.cost_type="{ item }">
                  <v-chip color="deep-purple" size="small" variant="outlined">
                    {{ item.cost_type }}
                  </v-chip>
                </template>

                <template #no-data>
                  <div class="text-center py-6 text-grey">
                    No expenditures for selected filters.
                  </div>
                </template>
              </v-data-table>
            </v-card>
          </v-col>
          <!-- Products table -->
          <v-col cols="12" md="5">
            <v-card elevation="2" rounded="lg">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" color="primary"
                  >mdi-package-variant</v-icon
                >
                Products Produced
                <v-spacer />
                <v-chip color="primary" size="small" variant="tonal">
                  {{ products.length }} product(s)
                </v-chip>
              </v-card-title>

              <v-progress-linear
                :active="loading"
                color="primary"
                height="3"
                :indeterminate="loading"
              />

              <v-data-table
                class="elevation-0"
                density="comfortable"
                :headers="productHeaders"
                hover
                :items="products"
              >
                <template #item.total_produced="{ item }">
                  {{ num(item.total_produced) }}
                </template>
                <template #item.selling_price="{ item }">
                  {{ money(item.selling_price) }}
                </template>
                <template #item.total_value="{ item }">
                  <v-chip color="green" size="small" variant="flat">
                    {{ money(item.total_value) }}
                  </v-chip>
                </template>
                <template #item.team_leader="{ item }">
                  <v-chip color="blue" size="small" variant="outlined">
                    <v-icon size="14" start>mdi-account-tie</v-icon>
                    {{ item.team_leader }}
                  </v-chip>
                </template>

                <template #no-data>
                  <div class="text-center py-6 text-grey">
                    No products for selected filters.
                  </div>
                </template>
              </v-data-table>
            </v-card>
          </v-col>
        </v-row>

        <!-- Expenditure Breakdown -->
        <v-row class="mt-4">
          <v-col cols="12">
            <v-card elevation="2" rounded="lg">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" color="deep-purple">mdi-chart-bar</v-icon>
                Expenditure Breakdown by Category
              </v-card-title>
              <v-card-text>
                <v-chart
                  :autoresize="true"
                  :option="expenditureBreakdownChart"
                  style="height: 400px"
                />
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
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
use([
  CanvasRenderer,
  PieChart,
  GaugeChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
]);

// ===== State =====
const loading = ref(false);
const summary = reactive({
  totalRevenue: 0,
  totalIngredientCost: 0,
  totalLabourCost: 0,
  totalExpenditure: 0,
  totalCost: 0,
  margin: 0,
});
const ingredients = ref([]);
const products = ref([]);
const expenditures = ref([]);

const ingredientOptions = ref([]);
const productOptions = ref([]);
const leaderOptions = ref([]);

// Filters
const dateRange = ref(null);
const filters = reactive({
  ingredients: [],
  products: [],
  team_leader: "",
});

// ===== Headers =====
const ingredientHeaders = [
  { title: "Ingredient", key: "ingredient_name", sortable: true },
  {
    title: "Qty Consumed",
    key: "total_consumed",
    sortable: true,
    align: "end",
  },
  { title: "Unit Price", key: "avg_price", sortable: true, align: "end" },
  { title: "Total Cost", key: "total_cost", sortable: true, align: "end" },
];

const productHeaders = [
  { title: "Product", key: "product_name", sortable: true },
  {
    title: "Qty Produced",
    key: "total_produced",
    sortable: true,
    align: "end",
  },
  {
    title: "Selling Price",
    key: "selling_price",
    sortable: true,
    align: "end",
  },
  { title: "Total Amount", key: "total_value", sortable: true, align: "end" },
  { title: "Team Leader", key: "team_leader", sortable: true },
];

const expenditureHeaders = [
  { title: "Cost Type", key: "cost_type", sortable: true },
  { title: "Amount", key: "amount", sortable: true, align: "end" },
];

// ===== Charts =====
const costDistributionChart = computed(() => {
  return {
    tooltip: {
      trigger: "item",
      formatter: "{a} <br/>{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      left: "left",
    },
    series: [
      {
        name: "Cost Distribution",
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
            fontSize: 18,
            fontWeight: "bold",
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          {
            value: summary.totalIngredientCost,
            name: "Ingredients",
            itemStyle: { color: "#ff9800" },
          },
          {
            value: summary.totalLabourCost,
            name: "Labour",
            itemStyle: { color: "#2196f3" },
          },
          {
            value: summary.totalExpenditure,
            name: "Other Expenditures",
            itemStyle: { color: "#9c27b0" },
          },
          {
            value: summary.margin,
            name: "Profit Margin",
            itemStyle: { color: summary.margin >= 0 ? "#4caf50" : "#f44336" },
          },
        ],
      },
    ],
  };
});

const profitabilityGauge = computed(() => {
  const profitPercentage =
    summary.totalRevenue > 0
      ? num((summary.margin / summary.totalRevenue) * 100)
      : 0;

  return {
    series: [
      {
        type: "gauge",
        startAngle: 180,
        endAngle: 0,
        min: -50,
        max: 100,
        splitNumber: 15,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [
              [0.166, "#ff6b6b"], // -50% to -33%: Red
              [0.333, "#ffa726"], // -33% to -16%: Orange
              [0.5, "#ffd93d"], // -16% to 0%: Yellow
              [0.666, "#d4e157"], // 0% to 16%: Light Green
              [0.833, "#9ccc65"], // 16% to 33%: Green
              [1, "#6bcf7f"], // 33% to 50%: Dark Green
            ],
          },
        },
        pointer: {
          icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
          length: "12%",
          width: 20,
          offsetCenter: [0, "-60%"],
          itemStyle: {
            color: "auto",
          },
        },
        axisTick: {
          length: 12,
          lineStyle: {
            color: "auto",
            width: 2,
          },
        },
        splitLine: {
          length: 20,
          lineStyle: {
            color: "auto",
            width: 5,
          },
        },
        axisLabel: {
          color: "#464646",
          fontSize: 12,
          distance: -60,
          formatter(value) {
            if (value === -50) return "Loss";
            if (value === 0) return "Break Even";
            if (value === 50) return "Good";
            if (value === 100) return "Excellent";
            return "";
          },
        },
        title: {
          offsetCenter: [0, "-20%"],
          fontSize: 16,
          fontWeight: "bold",
        },
        detail: {
          fontSize: 24,
          offsetCenter: [0, "0%"],
          valueAnimation: true,
          formatter: "{value}%",
          color: "auto",
          fontWeight: "bold",
        },
        data: [
          {
            value: Math.max(-50, Math.min(100, profitPercentage)),
            name: "Profit Margin %",
          },
        ],
      },
    ],
  };
});

const expenditureBreakdownChart = computed(() => {
  // Group expenditures by cost_type
  const expenditureByType = expenditures.value.reduce((acc, curr) => {
    const type = curr.cost_type || "Other";
    if (!acc[type]) {
      acc[type] = 0;
    }
    acc[type] += Number(curr.amount) || 0;
    return acc;
  }, {});

  const types = Object.keys(expenditureByType);
  const amounts = types.map((type) => expenditureByType[type]);

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: "{b}: {c}",
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: types,
      axisLabel: {
        rotate: 45,
      },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        formatter: "{value} TZS",
      },
    },
    series: [
      {
        name: "Expenditure Amount",
        type: "bar",
        data: amounts,
        itemStyle: {
          color(params) {
            const colors = [
              "#9c27b0",
              "#673ab7",
              "#3f51b5",
              "#2196f3",
              "#03a9f4",
            ];
            return colors[params.dataIndex % colors.length];
          },
        },
        label: {
          show: true,
          position: "top",
          formatter: "{c}",
        },
      },
    ],
  };
});

// ===== Helpers =====
function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 2,
  });
}

function num(v) {
  const n = Number(v || 0);
  return parseFloat(n.toLocaleString(undefined, { maximumFractionDigits: 3 }));
}

function formatDate(date) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-GB");
  } catch {
    return date;
  }
}

function toYMD(date) {
  if (!date) return "";
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Build query string
function buildQuery() {
  const params = new URLSearchParams();
  if (
    Array.isArray(dateRange.value) &&
    dateRange.value[0] &&
    dateRange.value[1]
  ) {
    params.append("start", toYMD(dateRange.value[0]));
    params.append("end", toYMD(dateRange.value[1]));
  }
  if (Array.isArray(filters.ingredients) && filters.ingredients.length) {
    filters.ingredients.forEach((id) => params.append("ingredients", id));
  }
  if (Array.isArray(filters.products) && filters.products.length) {
    filters.products.forEach((id) => params.append("products", id));
  }
  if (filters.team_leader) {
    params.append("team_leader", String(filters.team_leader));
  }
  return params.toString();
}

// ===== Actions =====
async function loadReport() {
  loading.value = true;
  try {
    const qs = buildQuery();
    const res = await fetch(`/reports/productionProfitability?${qs}`);
    const data = await res.json();

    // Update summary from backend response
    summary.totalRevenue = Number(data?.totals?.totalRevenue || 0);
    summary.totalIngredientCost = Number(
      data?.totals?.totalIngredientCost || 0,
    );
    summary.totalLabourCost = Number(data?.totals?.totalLabourCost || 0);
    summary.totalExpenditure = Number(data?.totals?.totalExpenditure || 0);
    summary.totalCost = Number(data?.totals?.totalCost || 0);
    summary.margin = Number(data?.totals?.margin || 0);

    // Update data arrays
    ingredients.value = data?.ingredients || [];
    products.value = data?.products || [];
    expenditures.value = data?.expenditures || [];
  } catch (e) {
    console.error("Failed to load report:", e);
    // Reset all data on error
    ingredients.value = [];
    products.value = [];
    expenditures.value = [];
    Object.keys(summary).forEach((key) => (summary[key] = 0));
  } finally {
    loading.value = false;
  }
}

async function loadLookups() {
  try {
    const [itemRes, productRes, staffRes] = await Promise.all([
      fetch("/items?limit=1000&page=1"),
      fetch("/products?limit=1000&page=1"),
      fetch("/staffs?status=Active&limit=1000&page=1"),
    ]);
    const [itemData, prodData, staffData] = await Promise.all([
      itemRes.json(),
      productRes.json(),
      staffRes.json(),
    ]);
    ingredientOptions.value = itemData?.data || itemData || [];
    productOptions.value = prodData?.data || prodData || [];
    leaderOptions.value = (staffData?.data || staffData || []).map((s) => ({
      id: s.id,
      name: s.name,
    }));
  } catch (e) {
    console.error("Failed to load lookups:", e);
    ingredientOptions.value = [];
    productOptions.value = [];
    leaderOptions.value = [];
  }
}

function resetFilters() {
  dateRange.value = null;
  filters.ingredients = [];
  filters.products = [];
  filters.team_leader = "";
  loadReport();
}

// ===== Lifecycle =====
onMounted(async () => {
  await loadLookups();
  await loadReport();
});
</script>

<style scoped>
.report-container {
  background: linear-gradient(180deg, #f6f8fb 0%, #ffffff 120%);
  min-height: 100vh;
}
.gap-2 {
  gap: 8px;
}
.border-success {
  border: 1px solid rgba(76, 175, 80, 0.35) !important;
}
.border-error {
  border: 1px solid rgba(244, 67, 54, 0.35) !important;
}
</style>
