<template>
  <v-container class="stock-report" fluid>
    <!-- Header -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h5 text-primary font-weight-bold mb-1">
              Stock Status Report
            </h1>
            <div class="text-body-2 text-grey">
              Opening balance, inwards, outwards & closing by ingredient
            </div>
          </div>
          <div class="d-flex gap-2">
            <v-btn
              color="primary"
              :disabled="!rows.length || loading"
              variant="outlined"
              @click="exportCSV"
            >
              <v-icon start>mdi-file-delimited-outline</v-icon> Export CSV
            </v-btn>
            <v-btn color="primary" :loading="loading" @click="applyFilters">
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
                auto-apply
                class="rounded-lg border px-4 py-2 w-100"
                format="dd-MM-yyyy"
                placeholder="From date"
                :teleport="true"
              />
              <VueDatePicker
                v-model="dateRange.end"
                auto-apply
                class="rounded-lg border px-4 py-2 w-100"
                format="dd-MM-yyyy"
                placeholder="To date"
                :teleport="true"
              />
            </div>
          </v-col>

          <!-- Ingredients multi-select -->
          <v-col cols="12" md="6">
            <v-autocomplete
              v-model="filters.items"
              chips
              clearable
              closable-chips
              color="primary"
              :disabled="itemsLoading"
              item-title="name"
              item-value="id"
              :items="allItems"
              label="Ingredients"
              :loading="itemsLoading"
              multiple
              variant="outlined"
            />
          </v-col>

          <!-- Unit Display Toggle -->
          <v-col cols="12" md="6">
            <v-switch
              v-model="showHumanReadableUnits"
              color="primary"
              hide-details
              label="Show Human Readable Units"
            />
          </v-col>

          <!-- Actions -->
          <v-col class="d-flex justify-end" cols="12">
            <v-btn color="primary" :loading="loading" @click="applyFilters">
              <v-icon start>mdi-filter</v-icon> Apply
            </v-btn>
            <v-btn
              class="ml-2"
              color="grey"
              :disabled="loading"
              variant="tonal"
              @click="resetFilters"
            >
              <v-icon start>mdi-refresh</v-icon> Reset
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Summary Cards -->
    <!-- Summary Cards Section - Updated to show price values -->
    <v-row class="mb-4">
      <v-col cols="12" md="3" sm="6">
        <v-card border class="pa-3" elevation="1">
          <div class="d-flex align-center">
            <v-avatar class="mr-3" color="blue-lighten-5" size="44">
              <v-icon color="blue">mdi-database-arrow-left</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Opening Value</div>
              <div class="text-h6">
                {{ formatCurrency(totals.opening_value) }}
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card border class="pa-3" elevation="1">
          <div class="d-flex align-center">
            <v-avatar class="mr-3" color="green-lighten-5" size="44">
              <v-icon color="green">mdi-tray-arrow-down</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Inwards Value</div>
              <div class="text-h6 text-success">
                {{ formatCurrency(totals.inwards_value) }}
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card border class="pa-3" elevation="1">
          <div class="d-flex align-center">
            <v-avatar class="mr-3" color="red-lighten-5" size="44">
              <v-icon color="red">mdi-tray-arrow-up</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Outwards Value</div>
              <div class="text-h6 text-error">
                {{ formatCurrency(totals.outwards_value) }}
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="3" sm="6">
        <v-card border class="pa-3" elevation="1">
          <div class="d-flex align-center">
            <v-avatar class="mr-3" color="purple-lighten-5" size="44">
              <v-icon color="purple">mdi-scale-balance</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey">Closing Value</div>
              <div class="text-h6">
                {{ formatCurrency(totals.closing_value) }}
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Loading bar -->
    <v-progress-linear
      :active="loading"
      color="primary"
      height="3"
      :indeterminate="loading"
    />

    <!-- Table -->
    <v-card elevation="1" rounded="lg">
      <v-card-text class="pa-0">
        <v-data-table
          class="elevation-0"
          density="comfortable"
          :headers="computedHeaders"
          item-key="item_id"
          :items="rows"
          :loading="loading"
        >
          <!-- Ingredient Column with Unit Info -->
          <template #item.item_name="{ item }">
            <div class="d-flex flex-column">
              <span class="font-weight-medium">{{ item.item_name }}</span>
              <div class="d-flex align-center mt-1">
                <v-chip
                  v-if="item.human_readable_unit"
                  class="mr-1"
                  color="primary"
                  size="x-small"
                  variant="outlined"
                >
                  {{ item.base_unit }}
                </v-chip>
                <v-chip
                  v-if="item.human_readable_unit && showHumanReadableUnits"
                  color="green"
                  size="x-small"
                  variant="outlined"
                >
                  {{ item.human_readable_unit }}
                </v-chip>
                <span v-else class="text-caption text-grey">
                  {{ item.unit_label || item.base_unit }}
                </span>
              </div>
            </div>
          </template>

          <!-- Opening Balance -->
          <template #item.opening_balance="{ item }">
            <div class="d-flex flex-column align-end">
              <span>{{ formatNumber(item.opening_balance) }}</span>
              <span
                v-if="showHumanReadableUnits && item.human_readable_unit"
                class="text-caption text-grey"
              >
                {{ formatNumber(item.opening_balance_human) }}
              </span>
            </div>
          </template>

          <!-- Inwards -->
          <template #item.inwards="{ item }">
            <div class="d-flex flex-column align-end">
              <span class="text-success">{{ formatNumber(item.inwards) }}</span>
              <span
                v-if="showHumanReadableUnits && item.human_readable_unit"
                class="text-caption text-grey"
              >
                {{ formatNumber(item.inwards_human) }}
              </span>
            </div>
          </template>

          <!-- Outwards -->
          <template #item.outwards="{ item }">
            <div class="d-flex flex-column align-end">
              <span class="text-error">{{ formatNumber(item.outwards) }}</span>
              <span
                v-if="showHumanReadableUnits && item.human_readable_unit"
                class="text-caption text-grey"
              >
                {{ formatNumber(item.outwards_human) }}
              </span>
            </div>
          </template>

          <!-- Closing Balance -->
          <template #item.closing_balance="{ item }">
            <div class="d-flex flex-column align-end">
              <strong>{{ formatNumber(item.closing_balance) }}</strong>
              <span
                v-if="showHumanReadableUnits && item.human_readable_unit"
                class="text-caption text-grey"
              >
                {{ formatNumber(item.closing_balance_human) }}
              </span>
            </div>
          </template>

          <!-- Value Columns -->
          <template #item.total_price_opening="{ item }">
            {{ formatCurrency(item.total_price_opening) }}
          </template>
          <template #item.total_price_inwards="{ item }">
            {{ formatCurrency(item.total_price_inwards) }}
          </template>
          <template #item.total_price_outwards="{ item }">
            {{ formatCurrency(item.total_price_outwards) }}
          </template>
          <template #item.total_price_closing="{ item }">
            {{ formatCurrency(item.total_price_closing) }}
          </template>

          <template #bottom>
            <div class="px-4 py-3 d-flex justify-end flex-wrap gap-2">
              <v-chip class="mr-2" color="blue" variant="tonal">
                Opening Value: {{ formatCurrency(totals.opening_value) }}
              </v-chip>
              <v-chip class="mr-2" color="green" variant="tonal">
                Inwards Value: {{ formatCurrency(totals.inwards_value) }}
              </v-chip>
              <v-chip class="mr-2" color="red" variant="tonal">
                Outwards Value: {{ formatCurrency(totals.outwards_value) }}
              </v-chip>
              <v-chip color="purple" variant="tonal">
                Closing Value: {{ formatCurrency(totals.closing_value) }}
              </v-chip>
            </div>
          </template>

          <template #no-data>
            <div class="text-center py-8">
              <v-icon class="mb-2" color="grey-lighten-2" size="64"
                >mdi-database-off</v-icon
              >
              <div class="text-subtitle-1 text-grey">
                No data for selected filters
              </div>
              <div class="text-body-2 text-grey">
                Adjust filters and try again.
              </div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";

const loading = ref(false);
const itemsLoading = ref(false);
const rows = ref([]);
const showHumanReadableUnits = ref(true);

const baseHeaders = [
  { title: "Ingredient", key: "item_name", sortable: true },
  { title: "Opening", key: "opening_balance", align: "end", sortable: true },
  { title: "Inwards", key: "inwards", align: "end", sortable: true },
  { title: "Outwards", key: "outwards", align: "end", sortable: true },
  { title: "Closing", key: "closing_balance", align: "end", sortable: true },
  {
    title: "Opening Value",
    key: "total_price_opening",
    align: "end",
    sortable: true,
  },
  {
    title: "Inwards Value",
    key: "total_price_inwards",
    align: "end",
    sortable: true,
  },
  {
    title: "Outwards Value",
    key: "total_price_outwards",
    align: "end",
    sortable: true,
  },
  {
    title: "Closing Value",
    key: "total_price_closing",
    align: "end",
    sortable: true,
  },
];

const computedHeaders = computed(() => {
  if (!showHumanReadableUnits.value) {
    return baseHeaders;
  }

  // Add human readable headers when toggle is on
  return [
    { title: "Ingredient", key: "item_name", sortable: true },
    {
      title: "Opening (Base/Human)",
      key: "opening_balance",
      align: "end",
      sortable: true,
    },
    {
      title: "Inwards (Base/Human)",
      key: "inwards",
      align: "end",
      sortable: true,
    },
    {
      title: "Outwards (Base/Human)",
      key: "outwards",
      align: "end",
      sortable: true,
    },
    {
      title: "Closing (Base/Human)",
      key: "closing_balance",
      align: "end",
      sortable: true,
    },
    {
      title: "Opening Value",
      key: "total_price_opening",
      align: "end",
      sortable: true,
    },
    {
      title: "Inwards Value",
      key: "total_price_inwards",
      align: "end",
      sortable: true,
    },
    {
      title: "Outwards Value",
      key: "total_price_outwards",
      align: "end",
      sortable: true,
    },
    {
      title: "Closing Value",
      key: "total_price_closing",
      align: "end",
      sortable: true,
    },
  ];
});

const filters = reactive({
  items: [], // array of item ids
});

const dateRange = reactive({
  start: null,
  end: null,
});

const allItems = ref([]);

const totals = computed(() => {
  const sum = (key) =>
    rows.value.reduce((a, b) => a + (Number(b[key]) || 0), 0);
  const sumHuman = (key) =>
    rows.value.reduce((a, b) => a + (Number(b[`${key}_human`]) || 0), 0);
  const sumPrice = (key) =>
    rows.value.reduce((a, b) => a + (Number(b[`total_price_${key}`]) || 0), 0);

  return {
    // Quantity totals (keep these if needed elsewhere)
    opening: sum("opening_balance"),
    opening_human: sumHuman("opening_balance"),
    inwards: sum("inwards"),
    inwards_human: sumHuman("inwards"),
    outwards: sum("outwards"),
    outwards_human: sumHuman("outwards"),
    closing: sum("closing_balance"),
    closing_human: sumHuman("closing_balance"),

    // Price totals (new - for the summary cards)
    opening_value: sumPrice("opening"),
    inwards_value: sumPrice("inwards"),
    outwards_value: sumPrice("outwards"),
    closing_value: sumPrice("closing"),
  };
});

function formatNumber(n) {
  const num = Number(n ?? 0);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

function formatCurrency(n) {
  const num = Number(n ?? 0);
  return `TSh ${num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

async function loadItems() {
  itemsLoading.value = true;
  try {
    const res = await fetch("/items?limit=10000&page=1");
    const data = await res.json();
    allItems.value = Array.isArray(data) ? data : data.data || [];
  } catch (e) {
    console.error("Failed to load items", e);
    allItems.value = [];
  } finally {
    itemsLoading.value = false;
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  if (dateRange.start)
    params.append("start_date", formatDateForApi(dateRange.start));
  if (dateRange.end) params.append("end_date", formatDateForApi(dateRange.end));
  if (filters.items && filters.items.length) {
    for (const id of filters.items) params.append("items", id);
  }
  return params.toString();
}

function formatDateForApi(d) {
  // Send as YYYY-MM-DD
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function applyFilters() {
  loading.value = true;
  try {
    const qs = buildQuery();
    const res = await fetch(`/reports/stockStatus?${qs}`);
    const data = await res.json();
    rows.value = data.data || [];
  } catch (e) {
    console.error("Failed to load report", e);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.items = [];
  dateRange.start = null;
  dateRange.end = null;
  applyFilters();
}

function exportCSV() {
  if (!rows.value.length) return;

  const cols = [
    "Ingredient",
    "Base Unit",
    "Human Readable Unit",
    "Opening Balance",
    "Opening Balance (Human)",
    "Inwards",
    "Inwards (Human)",
    "Outwards",
    "Outwards (Human)",
    "Closing Balance",
    "Closing Balance (Human)",
    "Opening Value",
    "Inwards Value",
    "Outwards Value",
    "Closing Value",
  ];

  const lines = [cols.join(",")];

  for (const r of rows.value) {
    lines.push(
      [
        `"${(r.item_name || "").replace(/"/g, '""')}"`,
        `"${r.base_unit || ""}"`,
        `"${r.human_readable_unit || ""}"`,
        r.opening_balance ?? 0,
        r.opening_balance_human ?? 0,
        r.inwards ?? 0,
        r.inwards_human ?? 0,
        r.outwards ?? 0,
        r.outwards_human ?? 0,
        r.closing_balance ?? 0,
        r.closing_balance_human ?? 0,
        r.total_price_opening ?? 0,
        r.total_price_inwards ?? 0,
        r.total_price_outwards ?? 0,
        r.total_price_closing ?? 0,
      ].join(","),
    );
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock_status_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  await loadItems();
  await applyFilters();
});
</script>

<style scoped>
.stock-report .gap-2 {
  gap: 8px;
}
.text-grey {
  color: #6b7280;
}
</style>
