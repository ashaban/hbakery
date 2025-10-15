<template>
  <v-container fluid class="report-container">
    <!-- Header -->
     <v-row>
        <v-col cols="12">
            <v-card class="pa-4" color="primary" dark>
            <v-card-title class="text-h4 font-weight-bold">
                <v-icon large class="mr-3">mdi-chart-arc</v-icon>
                Profit Projection Dashboard
            </v-card-title>
            </v-card>
        </v-col>
      </v-row>

      <!-- Summary Cards -->
    <v-row class="mt-4">
      <v-col cols="12" sm="6" md="3">
        <v-card class="profit-card" color="green-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon color="green-darken-2" size="48" class="mb-2">mdi-currency-usd</v-icon>
            <div class="text-h5 font-weight-bold text-green-darken-2">
              {{ money(summary.total_production_value) }}
            </div>
            <div class="text-caption text-grey">Total Production Value</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="cost-card" color="orange-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon color="orange-darken-2" size="48" class="mb-2">mdi-sack</v-icon>
            <div class="text-h5 font-weight-bold text-orange-darken-2">
              {{ money(summary.total_ingredient_cost) }}
            </div>
            <div class="text-caption text-grey">Ingredient Cost</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="cost-card" color="blue-lighten-5" elevation="4">
          <v-card-text class="text-center">
            <v-icon color="blue-darken-2" size="48" class="mb-2">mdi-account-hard-hat</v-icon>
            <div class="text-h5 font-weight-bold text-blue-darken-2">
              {{ money(summary.total_labour_cost) }}
            </div>
            <div class="text-caption text-grey">Labour Cost</div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="margin-card" :color="summary.margin >= 0 ? 'teal-lighten-5' : 'red-lighten-5'" elevation="4">
          <v-card-text class="text-center">
            <v-icon :color="summary.margin >= 0 ? 'teal-darken-2' : 'red-darken-2'" size="48" class="mb-2">
              {{ summary.margin >= 0 ? 'mdi-trending-up' : 'mdi-trending-down' }}
            </v-icon>
            <div class="text-h5 font-weight-bold" :class="summary.margin >= 0 ? 'text-teal-darken-2' : 'text-red-darken-2'">
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
        <v-card elevation="4" class="chart-card">
          <v-card-title class="text-h6">
            <v-icon class="mr-2">mdi-chart-pie</v-icon>
            Cost Distribution
          </v-card-title>
          <v-card-text>
            <v-chart :option="costDistributionChart" :autoresize="true" style="height: 300px;" />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Profitability Gauge -->
      <v-col cols="12" md="6">
        <v-card elevation="4" class="chart-card">
          <v-card-title class="text-h6">
            <v-icon class="mr-2">mdi-gauge</v-icon>
            Profitability Ratio
          </v-card-title>
          <v-card-text>
            <v-chart :option="profitabilityGauge" :autoresize="true" style="height: 300px;" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <!-- Ingredients table -->
      <v-col cols="12" md="12">
        <!-- Filters -->
        <v-card elevation="2" rounded="lg" class="mb-6">
          <v-card-text class="pa-4">
            <v-row dense>
              <!-- Date Range -->
              <v-col cols="12" md="4">
                <div class="mb-1 text-caption text-grey">Production Date Range</div>
                <VueDatePicker
                  v-model="dateRange"
                  range
                  :enable-time-picker="false"
                  :teleport="true"
                  auto-apply
                  placeholder="Select date range"
                  class="rounded-lg border px-4 py-2 w-100"
                />
              </v-col>

              <!-- Ingredients -->
              <v-col cols="12" md="4">
                <v-autocomplete
                  v-model="filters.ingredients"
                  :items="ingredientOptions"
                  item-title="name"
                  item-value="id"
                  label="Ingredients"
                  multiple
                  clearable
                  chips
                  closable-chips
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-food-apple"
                />
              </v-col>

              <!-- Products -->
              <v-col cols="12" md="4">
                <v-autocomplete
                  v-model="filters.products"
                  :items="productOptions"
                  item-title="name"
                  item-value="id"
                  label="Products"
                  multiple
                  clearable
                  chips
                  closable-chips
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-package-variant"
                />
              </v-col>

              <!-- Team Leader -->
              <v-col cols="12" md="4">
                <v-autocomplete
                  v-model="filters.team_leader"
                  :items="leaderOptions"
                  item-title="name"
                  item-value="id"
                  label="Team Leader (name or ID)"
                  clearable
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-account-tie"
                  :hint="filters.team_leader ? 'Filtering by selected leader' : 'Leave empty to include all leaders'"
                  persistent-hint
                />
              </v-col>

              <!-- Actions -->
              <v-col cols="12" class="d-flex justify-end">
                <div class="d-flex gap-2">
                  <v-btn color="primary" @click="loadReport" :loading="loading">
                    <v-icon start>mdi-filter</v-icon>
                    Apply Filters
                  </v-btn>
                  <v-btn color="primary" variant="flat" @click="loadReport" :loading="loading">
                    <v-icon start>mdi-refresh</v-icon>
                    Refresh
                  </v-btn>
                  <v-btn variant="outlined" color="grey" @click="resetFilters" :disabled="loading">
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
          <v-col cols="12" md="6">
            <v-card rounded="lg" elevation="2">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" color="primary">mdi-food-variant</v-icon>
                Ingredients Consumed
                <v-spacer />
                <v-chip size="small" variant="tonal" color="primary">
                  {{ ingredients.length }} item(s)
                </v-chip>
              </v-card-title>

              <v-progress-linear :active="loading" :indeterminate="loading" height="3" color="primary" />

              <v-data-table
                :headers="ingredientHeaders"
                :items="ingredients"
                class="elevation-0"
                density="comfortable"
                hover
              >
                <template #item.total_consumed="{ item }">
                  {{ num(item.total_consumed) }}
                </template>
                <template #item.avg_price="{ item }">
                  {{ money(item.avg_price) }}
                </template>
                <template #item.total_cost="{ item }">
                  <v-chip size="small" color="orange" variant="flat">
                    {{ money(item.total_cost) }}
                  </v-chip>
                </template>

                <template #no-data>
                  <div class="text-center py-6 text-grey">No ingredients for selected filters.</div>
                </template>
              </v-data-table>
            </v-card>
          </v-col>

          <!-- Products table -->
          <v-col cols="12" md="6">
            <v-card rounded="lg" elevation="2">
              <v-card-title class="d-flex align-center">
                <v-icon class="mr-2" color="primary">mdi-package-variant</v-icon>
                Products Produced
                <v-spacer />
                <v-chip size="small" variant="tonal" color="primary">
                  {{ products.length }} product(s)
                </v-chip>
              </v-card-title>

              <v-progress-linear :active="loading" :indeterminate="loading" height="3" color="primary" />

              <v-data-table
                :headers="productHeaders"
                :items="products"
                class="elevation-0"
                density="comfortable"
                hover
              >
                <template #item.total_produced="{ item }">
                  {{ num(item.total_produced) }}
                </template>
                <template #item.selling_price="{ item }">
                  {{ money(item.selling_price) }}
                </template>
                <template #item.total_value="{ item }">
                  <v-chip size="small" color="green" variant="flat">
                    {{ money(item.total_value) }}
                  </v-chip>
                </template>
                <template #item.team_leader="{ item }">
                  <v-chip size="small" variant="outlined" color="blue">
                    <v-icon start size="14">mdi-account-tie</v-icon>
                    {{ item.team_leader }}
                  </v-chip>
                </template>

                <template #no-data>
                  <div class="text-center py-6 text-grey">No products for selected filters.</div>
                </template>
              </v-data-table>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { use } from 'echarts/core';
import VChart from 'vue-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { PieChart, GaugeChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components';
use([
  CanvasRenderer,
  PieChart,
  GaugeChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
]);

// ===== State =====
const loading = ref(false)
const summary = reactive({
  total_ingredient_cost: 0,
  total_labour_cost: 0,
  total_production_value: 0,
  margin: 0
})
const ingredients = ref([])
const products = ref([])

const ingredientOptions = ref([])
const productOptions = ref([])
const leaderOptions = ref([])

// Filters
const dateRange = ref(null) // [startDate, endDate] as Date objects from VueDatePicker
const filters = reactive({
  ingredients: [],
  products: [],
  team_leader: '' // id OR string name; we pass as-is to API
})

// ===== Headers =====
const ingredientHeaders = [
  { title: 'Ingredient', key: 'ingredient_name', sortable: true },
  { title: 'Qty Consumed', key: 'total_consumed', sortable: true, align: 'end' },
  { title: 'Unit Price', key: 'avg_price', sortable: true, align: 'end' },
  { title: 'Total Cost', key: 'total_cost', sortable: true, align: 'end' }
]

const productHeaders = [
  { title: 'Product', key: 'product_name', sortable: true },
  { title: 'Qty Produced', key: 'total_produced', sortable: true, align: 'end' },
  { title: 'Selling Price', key: 'selling_price', sortable: true, align: 'end' },
  { title: 'Total Amount', key: 'total_value', sortable: true, align: 'end' }
]

const costDistributionChart = computed(() => {
  return {
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: 'Cost Distribution',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
          position: 'center',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
        labelLine: {
          show: false,
        },
        data: [
          {
            value: summary.total_ingredient_cost,
            name: 'Ingredients',
            itemStyle: { color: '#ff9800' },
          },
          {
            value: summary.total_labour_cost,
            name: 'Labour',
            itemStyle: { color: '#2196f3' },
          },
          {
            value: summary.margin,
            name: 'Profit Margin',
            itemStyle: { color: summary.margin >= 0 ? '#4caf50' : '#f44336' },
          },
        ],
      },
    ],
  }
})

const profitabilityGauge = computed(() => {
  const profitPercentage = num((summary.margin / summary.total_ingredient_cost) * 100);
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 6,
            color: [
              [0.3, '#ff6b6b'],
              [0.7, '#ffd93d'],
              [1, '#6bcf7f'],
            ],
          },
        },
        pointer: {
          icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
          length: '12%',
          width: 20,
          offsetCenter: [0, '-60%'],
          itemStyle: {
            color: 'auto',
          },
        },
        axisTick: {
          length: 12,
          lineStyle: {
            color: 'auto',
            width: 2,
          },
        },
        splitLine: {
          length: 20,
          lineStyle: {
            color: 'auto',
            width: 5,
          },
        },
        axisLabel: {
          color: '#464646',
          fontSize: 14,
          distance: -60,
          formatter: function (value) {
            if (value === 0) return 'Loss';
            if (value === 50) return 'Break Even';
            if (value === 100) return 'High Profit';
            return '';
          },
        },
        title: {
          offsetCenter: [0, '-20%'],
          fontSize: 16,
          fontWeight: 'bold',
        },
        detail: {
          fontSize: 24,
          offsetCenter: [0, '0%'],
          valueAnimation: true,
          formatter: '{value}%',
          color: 'auto',
          fontWeight: 'bold',
        },
        data: [
          {
            value: Math.max(0, Math.min(100, profitPercentage)),
            name: 'Profit Margin %',
          },
        ],
      },
    ],
  }
})

// ===== Helpers =====
function money(v) {
  const n = Number(v || 0)
  return n.toLocaleString(undefined, { style: 'currency', currency: 'TZS', maximumFractionDigits: 2 })
}
function num(v) {
  const n = Number(v || 0)
  return parseFloat(n.toLocaleString(undefined, { maximumFractionDigits: 3 }))
}
function toYMD(date) {
  if (!date) return ''
  const d = new Date(date)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Build query string
function buildQuery() {
  const params = new URLSearchParams()
  // date range
  if (Array.isArray(dateRange.value) && dateRange.value[0] && dateRange.value[1]) {
    params.append('start', toYMD(dateRange.value[0]))
    params.append('end', toYMD(dateRange.value[1]))
  }
  // ingredients[]
  if (Array.isArray(filters.ingredients) && filters.ingredients.length) {
    filters.ingredients.forEach(id => params.append('ingredients', id))
  }
  // products[]
  if (Array.isArray(filters.products) && filters.products.length) {
    filters.products.forEach(id => params.append('products', id))
  }
  // team leader (id or name)
  if (filters.team_leader) {
    params.append('team_leader', String(filters.team_leader))
  }
  return params.toString()
}

// ===== Actions =====
async function loadReport() {
  loading.value = true
  try {
    const qs = buildQuery()
    const res = await fetch(`/reports/productionProfitability?${qs}`)
    const data = await res.json()

    summary.total_ingredient_cost = Number(data?.totals?.totalIngredientCost || 0)
    summary.total_labour_cost = Number(data?.totals?.totalLabourCost || 0)
    summary.total_production_value = Number(data?.totals?.totalCost || 0)
    summary.margin = Number(data?.totals?.margin || 0)

    ingredients.value = data?.ingredients || []
    products.value = data?.products || []
  } catch (e) {
    console.error('Failed to load report:', e)
    ingredients.value = []
    products.value = []
    summary.total_ingredient_cost = 0
    summary.total_labour_cost = 0
    summary.total_production_value = 0
    summary.margin = 0
  } finally {
    loading.value = false
  }
}

async function loadLookups() {
  try {
    const [itemRes, productRes, staffRes] = await Promise.all([
      fetch('/items?limit=1000&page=1'),
      fetch('/products?limit=1000&page=1'),
      fetch('/staffs?status=Active&limit=1000&page=1')
    ])
    const [itemData, prodData, staffData] = await Promise.all([
      itemRes.json(),
      productRes.json(),
      staffRes.json()
    ])
    ingredientOptions.value = itemData?.data || itemData || []
    productOptions.value = prodData?.data || prodData || []
    leaderOptions.value = (staffData?.data || staffData || []).map(s => ({
      id: s.id,
      name: s.name
    }))
  } catch (e) {
    console.error('Failed to load lookups:', e)
    ingredientOptions.value = []
    productOptions.value = []
    leaderOptions.value = []
  }
}

function resetFilters() {
  dateRange.value = null
  filters.ingredients = []
  filters.products = []
  filters.team_leader = ''
  loadReport()
}

// ===== Lifecycle =====
onMounted(async () => {
  await loadLookups()
  await loadReport()
})
</script>

<style scoped>
.report-container {
  background: linear-gradient(180deg, #f6f8fb 0%, #ffffff 120%);
  min-height: 100vh;
}
.gap-2 { gap: 8px; }
.border-success { border: 1px solid rgba(76, 175, 80, 0.35) !important; }
.border-error { border: 1px solid rgba(244, 67, 54, 0.35) !important; }
.report-container {
  background: linear-gradient(180deg, #f6f8fb 0%, #ffffff 120%);
  min-height: 100vh;
}
.gap-2 { gap: 8px; }
.border-success { border: 1px solid rgba(76, 175, 80, 0.35) !important; }
.border-error { border: 1px solid rgba(244, 67, 54, 0.35) !important; }
</style>
