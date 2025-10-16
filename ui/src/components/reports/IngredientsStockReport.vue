<template>
  <v-container fluid class="stock-report">
    <!-- Header -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h5 text-primary font-weight-bold mb-1">Stock Status Report</h1>
            <div class="text-body-2 text-grey">Opening balance, inwards, outwards & closing by ingredient</div>
          </div>
          <div class="d-flex gap-2">
            <v-btn variant="outlined" color="primary" @click="exportCSV" :disabled="!rows.length || loading">
              <v-icon start>mdi-file-delimited-outline</v-icon> Export CSV
            </v-btn>
            <v-btn color="primary" @click="applyFilters" :loading="loading">
              <v-icon start>mdi-filter</v-icon> Apply
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Filters -->
    <v-card class="mb-4" elevation="1" rounded="lg">
      <v-card-text>
        <v-row dense>
          <!-- Date Range -->
          <v-col cols="12" md="6">
            <div class="text-caption text-grey mb-1">Date Range</div>
            <div class="d-flex align-center gap-2">
              <VueDatePicker
                v-model="dateRange.start"
                :teleport="true"
                auto-apply
                format="dd-MM-yyyy"
                placeholder="From date"
                class="rounded-lg border px-4 py-2 w-100"
              />
              <VueDatePicker
                v-model="dateRange.end"
                :teleport="true"
                auto-apply
                format="dd-MM-yyyy"
                placeholder="To date"
                class="rounded-lg border px-4 py-2 w-100"
              />
            </div>
          </v-col>

          <!-- Ingredients multi-select -->
          <v-col cols="12" md="6">
            <v-autocomplete
              v-model="filters.items"
              :items="allItems"
              item-title="name"
              item-value="id"
              label="Ingredients"
              variant="outlined"
              color="primary"
              chips
              closable-chips
              multiple
              clearable
              :loading="itemsLoading"
              :disabled="itemsLoading"
            />
          </v-col>

          <!-- Actions -->
          <v-col cols="12" class="d-flex justify-end">
            <v-btn color="primary" @click="applyFilters" :loading="loading">
              <v-icon start>mdi-filter</v-icon> Apply
            </v-btn>
            <v-btn class="ml-2" color="grey" variant="tonal" @click="resetFilters" :disabled="loading">
              <v-icon start>mdi-refresh</v-icon> Reset
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Summary Cards -->
    <v-row class="mb-4">
      <v-col cols="12" sm="6" md="3">
        <v-card border elevation="1" class="pa-3">
          <div class="d-flex align-center">
            <v-avatar color="blue-lighten-5" size="44" class="mr-3">
              <v-icon color="blue">mdi-database-arrow-left</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Opening</div>
              <div class="text-h6">{{ formatNumber(totals.opening) }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card border elevation="1" class="pa-3">
          <div class="d-flex align-center">
            <v-avatar color="green-lighten-5" size="44" class="mr-3">
              <v-icon color="green">mdi-tray-arrow-down</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Inwards</div>
              <div class="text-h6 text-success">{{ formatNumber(totals.inwards) }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card border elevation="1" class="pa-3">
          <div class="d-flex align-center">
            <v-avatar color="red-lighten-5" size="44" class="mr-3">
              <v-icon color="red">mdi-tray-arrow-up</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Outwards</div>
              <div class="text-h6 text-error">{{ formatNumber(totals.outwards) }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card border elevation="1" class="pa-3">
          <div class="d-flex align-center">
            <v-avatar color="purple-lighten-5" size="44" class="mr-3">
              <v-icon color="purple">mdi-scale-balance</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Closing</div>
              <div class="text-h6">{{ formatNumber(totals.closing) }}</div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading bar -->
    <v-progress-linear :active="loading" :indeterminate="loading" color="primary" height="3" />

    <!-- Table -->
    <v-card elevation="1" rounded="lg">
      <v-card-text class="pa-0">
        <v-data-table
          :headers="headers"
          :items="rows"
          :loading="loading"
          density="comfortable"
          class="elevation-0"
          item-key="item_id"
        >
          <template #item.opening_balance="{ item }">
            {{ formatNumber(item.opening_balance) }}
          </template>
          <template #item.inwards="{ item }">
            <span class="text-success">{{ formatNumber(item.inwards) }}</span>
          </template>
          <template #item.outwards="{ item }">
            <span class="text-error">{{ formatNumber(item.outwards) }}</span>
          </template>
          <template #item.closing_balance="{ item }">
            <strong>{{ formatNumber(item.closing_balance) }}</strong>
          </template>

          <template #bottom>
            <div class="px-4 py-3 d-flex justify-end">
              <v-chip variant="tonal" color="blue" class="mr-2">
                Opening: {{ formatNumber(totals.opening) }}
              </v-chip>
              <v-chip variant="tonal" color="green" class="mr-2">
                Inwards: {{ formatNumber(totals.inwards) }}
              </v-chip>
              <v-chip variant="tonal" color="red" class="mr-2">
                Outwards: {{ formatNumber(totals.outwards) }}
              </v-chip>
              <v-chip variant="tonal" color="purple">
                Closing: {{ formatNumber(totals.closing) }}
              </v-chip>
            </div>
          </template>

          <template #no-data>
            <div class="text-center py-8">
              <v-icon size="64" color="grey-lighten-2" class="mb-2">mdi-database-off</v-icon>
              <div class="text-subtitle-1 text-grey">No data for selected filters</div>
              <div class="text-body-2 text-grey">Adjust filters and try again.</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const loading = ref(false)
const itemsLoading = ref(false)
const rows = ref([])

const headers = [
  { title: 'Ingredient', key: 'item_name', sortable: true },
  { title: 'Opening', key: 'opening_balance', align: 'end', sortable: true },
  { title: 'Inwards', key: 'inwards', align: 'end', sortable: true },
  { title: 'Outwards', key: 'outwards', align: 'end', sortable: true },
  { title: 'Closing', key: 'closing_balance', align: 'end', sortable: true }
]

const filters = reactive({
  items: [] // array of item ids
})

const dateRange = reactive({
  start: null,
  end: null
})

const allItems = ref([])

const totals = computed(() => {
  const sum = (key) => rows.value.reduce((a, b) => a + (Number(b[key]) || 0), 0)
  return {
    opening: sum('opening_balance'),
    inwards: sum('inwards'),
    outwards: sum('outwards'),
    closing: sum('closing_balance')
  }
})

function formatNumber(n) {
  const num = Number(n ?? 0)
  return num.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

async function loadItems() {
  itemsLoading.value = true
  try {
    const res = await fetch('/items?limit=10000&page=1')
    const data = await res.json()
    allItems.value = Array.isArray(data) ? data : (data.data || [])
  } catch (e) {
    console.error('Failed to load items', e)
    allItems.value = []
  } finally {
    itemsLoading.value = false
  }
}

function buildQuery() {
  const params = new URLSearchParams()
  if (dateRange.start) params.append('start_date', formatDateForApi(dateRange.start))
  if (dateRange.end) params.append('end_date', formatDateForApi(dateRange.end))
  if (filters.items && filters.items.length) {
    for (const id of filters.items) params.append('items', id)
  }
  return params.toString()
}

function formatDateForApi(d) {
  // Send as YYYY-MM-DD
  const dt = new Date(d)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function applyFilters() {
  loading.value = true
  try {
    const qs = buildQuery()
    const res = await fetch(`/reports/stockStatus?${qs}`)
    const data = await res.json()
    rows.value = data.data || []
  } catch (e) {
    console.error('Failed to load report', e)
    rows.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.items = []
  dateRange.start = null
  dateRange.end = null
  applyFilters()
}

function exportCSV() {
  if (!rows.value.length) return
  const cols = ['Ingredient', 'Opening', 'Inwards', 'Outwards', 'Closing']
  const lines = [cols.join(',')]
  for (const r of rows.value) {
    lines.push([
      `"${(r.item_name || '').replace(/"/g, '""')}"`,
      r.opening_balance ?? 0,
      r.inwards ?? 0,
      r.outwards ?? 0,
      r.closing_balance ?? 0
    ].join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `stock_status_${new Date().toISOString().slice(0,10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await loadItems()
  await applyFilters()
})
</script>

<style scoped>
.stock-report .gap-2 { gap: 8px; }
.text-grey { color: #6b7280; }
</style>
