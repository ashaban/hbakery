<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="8">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-clipboard-text-clock</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Audit Log
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Who did what, where, and when
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="4">
            <v-btn color="primary" :loading="loading" size="large" @click="loadLog">
              <v-icon start>mdi-refresh</v-icon>
              Refresh
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
            <v-text-field
              v-model="filters.search"
              clearable
              density="comfortable"
              hide-details
              label="Search (description or user)"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              @keyup.enter="applyFilters"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.action"
              clearable
              density="comfortable"
              :items="actions"
              label="Action"
              :loading="loadingActions"
              variant="outlined"
              @update:model-value="applyFilters"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.entity_type"
              clearable
              density="comfortable"
              :items="entityTypes"
              label="Entity"
              variant="outlined"
              @update:model-value="applyFilters"
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
              @update:model-value="applyFilters"
            />
          </v-col>
          <v-col cols="12" sm="3">
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
              <v-date-picker v-model="dateRange" range @update:model-value="onDateRangeChange" />
            </v-menu>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- TABLE -->
    <v-card elevation="2">
      <v-progress-linear :active="loading" color="primary" height="4" :indeterminate="loading" />
      <v-data-table-server
        v-model:items-per-page="pagination.limit"
        v-model:page="pagination.currentPage"
        :headers="headers"
        :items="logEntries"
        :items-length="pagination.total"
        :loading="loading"
        loading-text="Loading audit log..."
        no-data-text="No matching audit entries found"
        @update:options="handlePagination"
      >
        <template #top>
          <v-card-title class="d-flex align-center pt-4">
            <v-icon class="mr-2" color="primary">mdi-table</v-icon>
            Activity
            <v-chip class="ml-3" color="primary" size="small" variant="flat">
              {{ formatNumber(pagination.total) }} total records
            </v-chip>
          </v-card-title>
          <v-divider />
        </template>

        <template #item.created_at="{ item }">
          <div class="text-no-wrap">{{ formatDateTime(item.created_at) }}</div>
        </template>

        <template #item.user_name="{ item }">
          <div class="d-flex align-center">
            <v-avatar class="mr-2" color="blue-lighten-4" size="32">
              <v-icon color="blue-darken-2" size="16">mdi-account</v-icon>
            </v-avatar>
            {{ item.user_name || "System" }}
          </div>
        </template>

        <template #item.action="{ item }">
          <v-chip :color="actionColor(item.action)" size="small" variant="flat">
            {{ item.action }}
          </v-chip>
        </template>

        <template #item.outlet_name="{ item }">
          <span v-if="item.outlet_name">{{ item.outlet_name }}</span>
          <span v-else class="text-grey">—</span>
        </template>

        <template #item.description="{ item }">
          <div>
            {{ item.description }}
            <div v-if="item.details" class="text-caption text-grey">
              <a href="#" @click.prevent="toggleDetails(item)">
                {{ expanded === item.id ? "Hide details" : "View details" }}
              </a>
              <pre v-if="expanded === item.id" class="details-json">{{ formatDetails(item.details) }}</pre>
            </div>
          </div>
        </template>

        <template #bottom>
          <v-card-actions class="px-4 py-3 bg-grey-lighten-3">
            <div class="text-caption text-grey">
              Showing {{ getDisplayRange() }} of {{ formatNumber(pagination.total) }} entries
            </div>
            <v-spacer />
            <v-select
              v-model="pagination.limit"
              density="compact"
              :items="[25, 50, 100, 200]"
              label="Items per page"
              style="max-width: 150px"
              variant="outlined"
              @update:model-value="loadLog"
            />
            <v-pagination
              v-model="pagination.currentPage"
              color="primary"
              :length="pagination.totalPages"
              total-visible="7"
              @update:model-value="loadLog"
            />
          </v-card-actions>
        </template>
      </v-data-table-server>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";

const store = useStore();

const loading = ref(false);
const loadingActions = ref(false);
const loadingOutlets = ref(false);
const logEntries = ref([]);
const actions = ref([]);
const outlets = ref([]);
const expanded = ref(null);

const entityTypes = [
  "stock_transfer",
  "sale",
  "sale_customer_debt",
  "production_batch",
  "product_out",
  "expenditure",
  "loan",
  "itempurchase",
  "users",
  "stock_quality_adjustment",
];

const pagination = reactive({
  currentPage: 1,
  totalPages: 1,
  total: 0,
  limit: 50,
});

const dateRange = ref([]);

const filters = reactive({
  search: "",
  action: "",
  entity_type: "",
  outlet_id: "",
  date_from: "",
  date_to: "",
});

const dateRangeText = computed(() => {
  if (dateRange.value && dateRange.value.length === 2) {
    return `${formatDate(dateRange.value[0])} - ${formatDate(dateRange.value[1])}`;
  }
  return "All dates";
});

const headers = [
  { title: "Date/Time", key: "created_at", sortable: false },
  { title: "User", key: "user_name", sortable: false },
  { title: "Action", key: "action", sortable: false },
  { title: "Outlet", key: "outlet_name", sortable: false },
  { title: "Description", key: "description", sortable: false },
];

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function formatDateTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n) {
  return new Intl.NumberFormat().format(n || 0);
}

function getDisplayRange() {
  const start = pagination.total === 0 ? 0 : (pagination.currentPage - 1) * pagination.limit + 1;
  const end = Math.min(pagination.currentPage * pagination.limit, pagination.total);
  return `${formatNumber(start)} - ${formatNumber(end)}`;
}

function actionColor(action) {
  if (action.endsWith("_DELETE") || action.endsWith("_CANCEL")) return "red";
  if (action.endsWith("_EDIT")) return "orange";
  if (action.endsWith("_CREATE") || action === "LOGIN") return "green";
  return "blue-grey";
}

function toggleDetails(item) {
  expanded.value = expanded.value === item.id ? null : item.id;
}

function formatDetails(details) {
  return JSON.stringify(details, null, 2);
}

function onDateRangeChange(newRange) {
  if (newRange && newRange.length === 2) {
    const [a, b] = [...newRange].sort();
    filters.date_from = a;
    filters.date_to = b;
    applyFilters();
  }
}

function applyFilters() {
  pagination.currentPage = 1;
  loadLog();
}

function buildParams() {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.action) params.append("action", filters.action);
  if (filters.entity_type) params.append("entity_type", filters.entity_type);
  if (filters.outlet_id) params.append("outlet_id", filters.outlet_id);
  if (filters.date_from) params.append("date_from", filters.date_from);
  if (filters.date_to) params.append("date_to", filters.date_to);
  params.append("page", pagination.currentPage);
  params.append("limit", pagination.limit);
  return params;
}

async function loadLog() {
  loading.value = true;
  try {
    const res = await fetch(`/auditlog?${buildParams()}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    logEntries.value = data.data || [];
    if (data.pagination) {
      Object.assign(pagination, {
        currentPage: data.pagination.currentPage,
        totalPages: data.pagination.totalPages,
        total: data.pagination.total,
        limit: data.pagination.limit,
      });
    }
  } catch (error) {
    console.error("Error loading audit log:", error);
    store.commit("setMessage", { type: "error", text: "Failed to load audit log" });
  } finally {
    loading.value = false;
  }
}

function handlePagination(options) {
  if (options.page !== pagination.currentPage || options.itemsPerPage !== pagination.limit) {
    pagination.currentPage = options.page;
    pagination.limit = options.itemsPerPage;
    loadLog();
  }
}

async function loadActions() {
  loadingActions.value = true;
  try {
    const res = await fetch("/auditlog/actions");
    const data = await res.json();
    actions.value = data.data || [];
  } catch (error) {
    console.error("Error loading audit actions:", error);
  } finally {
    loadingActions.value = false;
  }
}

async function loadOutlets() {
  loadingOutlets.value = true;
  try {
    const res = await fetch("/outlets?limit=1000&active=true");
    const data = await res.json();
    outlets.value = data.data || [];
  } catch (error) {
    console.error("Error loading outlets:", error);
  } finally {
    loadingOutlets.value = false;
  }
}

onMounted(() => {
  loadLog();
  loadActions();
  loadOutlets();
});
</script>

<style scoped>
.details-json {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 8px;
  margin-top: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
