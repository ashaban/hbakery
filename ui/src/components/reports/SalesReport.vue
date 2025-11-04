<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-chart-areaspline</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Sales Dashboard
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Sales, COGS, expenditures, losses, and margin
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-btn color="primary" size="large" @click="loadReport">
              <v-icon start>mdi-refresh</v-icon> Refresh
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

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
              prepend-inner-icon="mdi-store"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="filters.start_date"
              density="comfortable"
              label="Start Date"
              prepend-inner-icon="mdi-calendar"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="filters.end_date"
              density="comfortable"
              label="End Date"
              prepend-inner-icon="mdi-calendar"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex justify-end" cols="12" sm="3">
            <v-btn class="mr-2" color="primary" @click="loadReport">
              <v-icon start>mdi-magnify</v-icon> Apply
            </v-btn>
            <v-btn color="grey" variant="outlined" @click="resetFilters">
              <v-icon start>mdi-refresh</v-icon> Reset
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- KPI CARDS -->
    <v-row class="mb-6" dense>
      <v-col cols="12" md="2">
        <v-card elevation="2">
          <v-card-text class="py-4 text-center">
            <div class="text-caption text-grey">Sales</div>
            <div class="text-h5 font-weight-bold">
              {{ money(kpis.total_sales) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="2">
          <v-card-text class="py-4 text-center">
            <div class="text-caption text-grey">COGS</div>
            <div class="text-h5 font-weight-bold">
              {{ money(kpis.total_cogs) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="2">
          <v-card-text class="py-4 text-center">
            <div class="text-caption text-grey">Expenditures</div>
            <div class="text-h5 font-weight-bold">
              {{ money(kpis.total_expenditures) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="2">
        <v-card elevation="2">
          <v-card-text class="py-4 text-center">
            <div class="text-caption text-grey">Losses</div>
            <div class="text-h5 font-weight-bold">
              {{ money(kpis.total_lost_value) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card
          :color="kpis.total_margin >= 0 ? 'green-lighten-5' : 'red-lighten-5'"
          elevation="2"
        >
          <v-card-text class="py-4 text-center">
            <div class="text-caption text-grey">Margin</div>
            <div class="text-h4 font-weight-bold">
              {{ money(kpis.total_margin) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- CHARTS -->
    <v-row class="mb-6" dense>
      <v-col cols="12" md="7">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1"
            >Sales vs COGS vs Margin (Daily)</v-card-title
          >
          <v-card-text>
            <div ref="tlRef" style="height: 320px" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="5">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1"
            >Sales by Product (Top)</v-card-title
          >
          <v-card-text>
            <div ref="pieRef" style="height: 320px" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mb-6" dense>
      <v-col cols="12" md="6">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1">Losses by Reason</v-card-title>
          <v-card-text>
            <div ref="donutRef" style="height: 300px" />
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card elevation="2">
          <v-card-title class="text-subtitle-1"
            >Revenue vs COGS (Top Products)</v-card-title
          >
          <v-card-text>
            <div ref="barRef" style="height: 300px" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- TABLES -->
    <v-card class="mb-6" elevation="2">
      <v-card-title class="text-subtitle-1">Product Performance</v-card-title>
      <v-data-table
        class="elevation-0"
        :headers="prodHeaders"
        :items="tables.products_sales"
      />
    </v-card>

    <v-card class="mb-6" elevation="2">
      <v-card-title class="text-subtitle-1">Losses</v-card-title>
      <v-data-table
        class="elevation-0"
        :headers="lossHeaders"
        :items="tables.losses"
      />
    </v-card>

    <v-card class="mb-6" elevation="2">
      <v-card-title class="text-subtitle-1">Expenditures</v-card-title>
      <v-data-table
        class="elevation-0"
        :headers="expHeaders"
        :items="tables.expenditures"
      />
    </v-card>
  </v-container>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from "vue";
import * as echarts from "echarts";

const outlets = ref([]);
const filters = reactive({
  outlet_id: "",
  start_date: new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString()
    .split("T")[0],
  end_date: new Date().toISOString().split("T")[0],
});

const kpis = reactive({
  total_sales: 0,
  total_cogs: 0,
  total_expenditures: 0,
  total_lost_value: 0,
  total_margin: 0,
});

const chartData = reactive({
  sales_timeline: [],
  sales_by_product: [],
  loss_by_reason: [],
});

const tables = reactive({
  products_sales: [],
  losses: [],
  expenditures: [],
});

const prodHeaders = [
  { title: "Product", key: "name" },
  { title: "Qty", key: "qty", align: "end" },
  { title: "Revenue", key: "revenue", align: "end" },
  { title: "COGS", key: "cogs", align: "end" },
  { title: "Margin", key: "margin", align: "end" },
];

const lossHeaders = [
  { title: "Date", key: "date" },
  { title: "Product", key: "product_name" },
  { title: "Reason", key: "reason" },
  { title: "Qty", key: "qty", align: "end" },
  { title: "Value", key: "value", align: "end" },
];

const expHeaders = [
  { title: "Date", key: "date" },
  { title: "Category", key: "category" },
  { title: "Remarks", key: "remarks" },
  { title: "Amount", key: "amount", align: "end" },
];

// charts refs
const tlRef = ref(null);
const pieRef = ref(null);
const donutRef = ref(null);
const barRef = ref(null);

let tlChart, pieChart, donutChart, barChart;

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function mountCharts() {
  tlChart = echarts.init(tlRef.value);
  pieChart = echarts.init(pieRef.value);
  donutChart = echarts.init(donutRef.value);
  barChart = echarts.init(barRef.value);
  window.addEventListener("resize", () => {
    tlChart.resize();
    pieChart.resize();
    donutChart.resize();
    barChart.resize();
  });
}

function renderCharts() {
  // timeline
  const dates = chartData.sales_timeline.map((d) => d.date);
  const sales = chartData.sales_timeline.map((d) => d.sales);
  const cogs = chartData.sales_timeline.map((d) => d.cogs);
  const margin = chartData.sales_timeline.map((d) => d.margin);

  tlChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["Sales", "COGS", "Margin"] },
    xAxis: { type: "category", data: dates },
    yAxis: { type: "value" },
    series: [
      { name: "Sales", type: "bar", data: sales, stack: "sum" },
      { name: "COGS", type: "bar", data: cogs, stack: "sum" },
      { name: "Margin", type: "line", data: margin, smooth: true },
    ],
  });

  // pie (sales by product)
  pieChart.setOption({
    tooltip: { trigger: "item" },
    series: [
      {
        name: "Sales",
        type: "pie",
        radius: "70%",
        data: chartData.sales_by_product.map((r) => ({
          name: r.name,
          value: r.revenue,
        })),
        emphasis: { scale: true },
      },
    ],
  });

  // donut (loss by reason)
  donutChart.setOption({
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        data: chartData.loss_by_reason.map((r) => ({
          name: r.reason,
          value: r.value,
        })),
        label: { formatter: "{b}: {c}" },
      },
    ],
  });

  // bar (rev vs cogs top products)
  const names = tables.products_sales.slice(0, 12).map((x) => x.name);
  const rev = tables.products_sales.slice(0, 12).map((x) => x.revenue);
  const cg = tables.products_sales.slice(0, 12).map((x) => x.cogs);
  barChart.setOption({
    tooltip: { trigger: "axis" },
    legend: { data: ["Revenue", "COGS"] },
    xAxis: { type: "category", data: names },
    yAxis: { type: "value" },
    series: [
      { name: "Revenue", type: "bar", data: rev },
      { name: "COGS", type: "bar", data: cg },
    ],
  });
}

async function loadReport() {
  const params = new URLSearchParams();
  if (filters.outlet_id) params.append("outlet_id", filters.outlet_id);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);

  const res = await fetch(`/reports/sales-summary?${params.toString()}`);
  const data = await res.json();

  kpis.total_sales = data.kpis.total_sales || 0;
  kpis.total_cogs = data.kpis.total_cogs || 0;
  kpis.total_expenditures = data.kpis.total_expenditures || 0;
  kpis.total_lost_value = data.kpis.total_lost_value || 0;
  kpis.total_margin = data.kpis.total_margin || 0;

  chartData.sales_timeline = data.chartData.sales_timeline || [];
  chartData.sales_by_product = data.chartData.sales_by_product || [];
  chartData.loss_by_reason = data.chartData.loss_by_reason || [];

  tables.products_sales = data.tables.products_sales || [];
  tables.losses = data.tables.losses || [];
  tables.expenditures = data.tables.expenditures || [];

  renderCharts();
}

async function loadOutlets() {
  const outRes = await fetch("/outlets?limit=1000");
  const out = await outRes.json();
  outlets.value = out.data || [];
}

function resetFilters() {
  filters.outlet_id = "";
  filters.start_date = new Date(new Date().setDate(new Date().getDate() - 30))
    .toISOString()
    .split("T")[0];
  filters.end_date = new Date().toISOString().split("T")[0];
  loadReport();
}

onMounted(async () => {
  await loadOutlets();
  mountCharts();
  await loadReport();
});
</script>
