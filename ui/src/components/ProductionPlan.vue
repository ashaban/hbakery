<template>
  <v-container class="pb-10" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center justify-space-between flex-wrap ga-4">
          <div>
            <h1 class="text-h4 font-weight-bold text-primary mb-2">
              Production Plan
            </h1>
            <p class="text-body-1 text-grey mb-0">
              Given expected sales per driver/outlet for a day, work out how
              much of each product to produce, how many mixer batches that
              is, and how much flour each staff member needs.
            </p>
          </div>
          <div class="d-flex ga-2">
            <v-btn
              color="secondary"
              prepend-icon="mdi-history"
              variant="outlined"
              @click="openHistoryDialog"
            >
              Previous Plans
            </v-btn>
            <v-btn
              color="secondary"
              prepend-icon="mdi-truck-delivery-outline"
              variant="outlined"
              @click="openAddRouteDialog"
            >
              Add Driver / Outlet
            </v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- DATE SELECTION -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <v-row dense>
          <v-col cols="12" md="4">
            <DateField v-model="saleDate" label="Sale Date" required />
          </v-col>
          <v-col cols="12" md="4">
            <DateField
              v-model="productionDate"
              label="Production Date"
              required
            />
          </v-col>
          <v-col class="d-flex align-center" cols="12" md="4">
            <v-chip v-if="planExists" color="success" variant="flat">
              <v-icon start>mdi-content-save-check</v-icon>
              Saved plan loaded
            </v-chip>
            <v-chip v-else color="grey-lighten-1" variant="flat">
              <v-icon start>mdi-file-outline</v-icon>
              New plan (not yet saved)
            </v-chip>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-alert v-if="!planRoutes.length" class="mb-6" type="info" variant="tonal">
      No drivers/outlets added to this plan yet. Click "Add Driver / Outlet"
      to pick who's taking goods where on {{ formatDMY(saleDate) }}.
    </v-alert>

    <!-- SALES PROJECTION GRID -->
    <v-card v-if="planRoutes.length" class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-4">
          <v-icon class="mr-2" color="primary">mdi-table-large</v-icon>
          <h3 class="text-h6 font-weight-medium">
            Expected Sales ({{ formatDMY(saleDate) }})
          </h3>
        </div>

        <div class="table-scroll">
          <table class="plan-table">
            <thead>
              <tr>
                <th class="product-col">Product</th>
                <th v-for="r in planRoutes" :key="r.key">
                  <div class="d-flex align-center justify-space-between ga-1">
                    <span>
                      <template v-if="r.staff_name && r.outlet_name">
                        {{ r.staff_name }}
                        <div class="text-caption text-grey">{{ r.outlet_name }}</div>
                      </template>
                      <template v-else-if="r.staff_name">
                        <v-icon size="14">mdi-truck-delivery-outline</v-icon>
                        {{ r.staff_name }}
                      </template>
                      <template v-else>
                        <v-icon size="14">mdi-store</v-icon>
                        {{ r.outlet_name }}
                      </template>
                    </span>
                    <v-btn
                      color="error"
                      density="compact"
                      icon
                      size="x-small"
                      variant="text"
                      @click="removeRouteEntry(r)"
                    >
                      <v-icon size="16">mdi-close</v-icon>
                    </v-btn>
                  </div>
                </th>
                <th class="total-col">Total</th>
                <th class="mixer-col">Mixer Batches</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in products" :key="p.id">
                <td class="product-col font-weight-medium">{{ p.name }}</td>
                <td v-for="r in planRoutes" :key="r.key">
                  <v-text-field
                    v-model.number="quantities[cellKey(p.id, r.key)]"
                    autocomplete="off"
                    density="compact"
                    hide-details
                    min="0"
                    type="number"
                    variant="outlined"
                  />
                </td>
                <td class="total-col text-center font-weight-bold">
                  {{ rowTotal(p.id) }}
                </td>
                <td class="mixer-col text-center">
                  <template v-if="p.units_per_batch">
                    {{ rowMixer(p.id).toFixed(2) }}
                  </template>
                  <v-tooltip v-else location="top">
                    <template #activator="{ props: tp }">
                      <v-icon v-bind="tp" color="warning" size="18"
                        >mdi-alert-circle-outline</v-icon
                      >
                    </template>
                    Set "Units per Batch" on this product to compute mixer
                    batches.
                  </v-tooltip>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
    </v-card>

    <!-- STAFF SPLIT -->
    <v-card v-if="planRoutes.length" class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <div class="d-flex align-center mb-4">
          <v-icon class="mr-2" color="primary">mdi-account-group</v-icon>
          <h3 class="text-h6 font-weight-medium">
            Staff Split &amp; Flour Needed ({{ formatDMY(productionDate) }})
          </h3>
        </div>

        <div
          v-for="p in productsNeedingProduction"
          :key="p.id"
          class="mb-4 pb-4 split-row"
        >
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="font-weight-medium">
              {{ p.name }}
              <span class="text-grey text-body-2 ml-2">
                ({{ rowMixer(p.id).toFixed(2) }} batches needed)
              </span>
            </div>
            <v-btn size="small" variant="text" @click="addStaffRow(p.id)">
              <v-icon start>mdi-plus</v-icon>
              Add Staff
            </v-btn>
          </div>

          <v-row
            v-for="(split, idx) in staffSplits[p.id] || []"
            :key="idx"
            align="center"
            dense
          >
            <v-col cols="12" sm="5">
              <v-autocomplete
                v-model="split.staff_id"
                autocomplete="off"
                density="compact"
                hide-details
                item-title="name"
                item-value="id"
                :items="staffList"
                label="Staff"
                variant="outlined"
              />
            </v-col>
            <v-col cols="6" sm="3">
              <v-text-field
                v-model.number="split.batches"
                autocomplete="off"
                density="compact"
                hide-details
                label="Batches"
                min="0"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col cols="5" sm="3">
              <div class="text-body-2 text-grey">
                Flour: {{ splitFlourKg(p, split) }} kg
              </div>
            </v-col>
            <v-col class="text-right" cols="1">
              <v-btn
                color="error"
                icon
                size="small"
                variant="text"
                @click="removeStaffRow(p.id, idx)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-col>
          </v-row>

          <div
            v-if="!(staffSplits[p.id] || []).length"
            class="text-caption text-grey"
          >
            No staff assigned yet.
          </div>
        </div>

        <v-alert v-if="!productsNeedingProduction.length" type="info" variant="tonal">
          Enter expected sales above to see which products need a staff
          split.
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- NOTES + ACTIONS -->
    <v-card v-if="planRoutes.length" elevation="2" rounded="lg">
      <v-card-text class="pa-6">
        <v-textarea
          v-model="notes"
          autocomplete="off"
          density="comfortable"
          label="Notes"
          rows="2"
          variant="outlined"
        />
        <div class="d-flex justify-end ga-2 mt-2">
          <v-btn
            v-if="planExists"
            color="error"
            :loading="deleting"
            variant="outlined"
            @click="deletePlan"
          >
            Delete Plan
          </v-btn>
          <v-btn color="primary" :loading="saving" variant="flat" @click="savePlan">
            <v-icon start>mdi-content-save</v-icon>
            Save Plan
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- ADD DRIVER / OUTLET DIALOG -->
    <v-dialog v-model="addRouteDialog" max-width="500">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-toolbar-title class="text-h6 font-weight-bold">
            Add Driver / Outlet
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="addRouteDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-6">
          <p class="text-body-2 text-grey mb-4">
            A driver going out to sell is its own column, same as an
            outlet's own sales staff — pick as many of each as apply. They
            don't need to be paired up.
          </p>
          <v-autocomplete
            v-model="newRoute.staff_ids"
            autocomplete="off"
            chips
            class="mb-2"
            closable-chips
            density="comfortable"
            item-title="name"
            item-value="id"
            :items="staffList"
            label="Drivers"
            multiple
            prepend-inner-icon="mdi-account-tie"
            variant="outlined"
          />
          <v-autocomplete
            v-model="newRoute.outlet_ids"
            autocomplete="off"
            chips
            closable-chips
            density="comfortable"
            item-title="name"
            item-value="id"
            :items="outletList"
            label="Outlets"
            multiple
            prepend-inner-icon="mdi-store"
            variant="outlined"
          />
          <v-btn
            block
            color="primary"
            :disabled="
              !newRoute.staff_ids.length && !newRoute.outlet_ids.length
            "
            variant="flat"
            @click="addRouteEntry"
          >
            <v-icon start>mdi-plus</v-icon>
            Add to Plan
          </v-btn>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- PREVIOUS PLANS DIALOG -->
    <v-dialog v-model="historyDialog" max-width="600">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-toolbar-title class="text-h6 font-weight-bold">
            Previous Plans
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="historyDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-6">
          <div v-if="historyLoading" class="text-center py-6">
            <v-progress-circular color="primary" indeterminate />
          </div>
          <v-alert v-else-if="!planHistory.length" type="info" variant="tonal">
            No saved plans yet.
          </v-alert>
          <v-list v-else>
            <v-list-item
              v-for="h in planHistory"
              :key="h.id"
              class="rounded-lg mb-1"
              :class="{ 'bg-primary-lighten-5': h.sale_date === currentSaleDateISO }"
              @click="selectHistoryPlan(h)"
            >
              <v-list-item-title class="font-weight-medium">
                Sale {{ formatDMY(h.sale_date) }}
              </v-list-item-title>
              <v-list-item-subtitle>
                Production {{ formatDMY(h.production_date) }} ·
                {{ h.total_units }} units planned
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useStore } from "vuex";
import { formatDMY, toISODateOnly } from "@/utils/date.js";
import DateField from "@/components/shared/DateField.vue";

const store = useStore();

const saleDate = ref(formatDMY(new Date()));
const productionDate = ref("");
const notes = ref("");
const planExists = ref(false);
const saving = ref(false);
const deleting = ref(false);

const products = ref([]);
const staffList = ref([]);
const outletList = ref([]);

// This plan's selected (driver, outlet) pairs — scoped to the plan being
// edited, not a globally-managed list (who drives where changes day to
// day). Each entry's key is `${staff_id}-${outlet_id}`.
const planRoutes = ref([]);

// quantities[`${productId}-${routeKey}`] = quantity
const quantities = reactive({});
// staffSplits[productId] = [{ staff_id, batches }]
const staffSplits = reactive({});

const addRouteDialog = ref(false);
const newRoute = reactive({ staff_ids: [], outlet_ids: [] });

const historyDialog = ref(false);
const historyLoading = ref(false);
const planHistory = ref([]);
const currentSaleDateISO = computed(() => toISODateOnly(saleDate.value));

// A route is either a driver going out to sell (staffId set, outletId
// null) or a fixed outlet's own sales staff (outletId set, staffId
// null) — never required to be both.
function routeKey(staffId, outletId) {
  return `${staffId || ""}-${outletId || ""}`;
}

function cellKey(productId, key) {
  return `${productId}-${key}`;
}

function rowTotal(productId) {
  return planRoutes.value.reduce(
    (sum, r) => sum + (Number(quantities[cellKey(productId, r.key)]) || 0),
    0,
  );
}

function rowMixer(productId) {
  const p = products.value.find((pr) => pr.id === productId);
  if (!p || !p.units_per_batch) return 0;
  return rowTotal(productId) / Number(p.units_per_batch);
}

const productsNeedingProduction = computed(() =>
  products.value.filter((p) => rowTotal(p.id) > 0),
);

function splitFlourKg(product, split) {
  if (!product.flour_kg_per_batch || !split.batches) return 0;
  return (Number(split.batches) * Number(product.flour_kg_per_batch)).toFixed(
    2,
  );
}

function addStaffRow(productId) {
  if (!staffSplits[productId]) staffSplits[productId] = [];
  staffSplits[productId].push({ staff_id: null, batches: "" });
}

function removeStaffRow(productId, idx) {
  staffSplits[productId]?.splice(idx, 1);
}

function openAddRouteDialog() {
  newRoute.staff_ids = [];
  newRoute.outlet_ids = [];
  addRouteDialog.value = true;
}

function addRouteEntry() {
  let added = 0;
  let skipped = 0;

  for (const staffId of newRoute.staff_ids) {
    const key = routeKey(staffId, null);
    if (planRoutes.value.some((r) => r.key === key)) {
      skipped++;
      continue;
    }
    planRoutes.value.push({
      key,
      staff_id: staffId,
      staff_name: staffList.value.find((s) => s.id === staffId)?.name,
      outlet_id: null,
      outlet_name: null,
    });
    added++;
  }

  for (const outletId of newRoute.outlet_ids) {
    const key = routeKey(null, outletId);
    if (planRoutes.value.some((r) => r.key === key)) {
      skipped++;
      continue;
    }
    planRoutes.value.push({
      key,
      staff_id: null,
      staff_name: null,
      outlet_id: outletId,
      outlet_name: outletList.value.find((o) => o.id === outletId)?.name,
    });
    added++;
  }

  if (skipped) {
    store.commit("setMessage", {
      type: "error",
      text: `${skipped} driver(s)/outlet(s) were already on this plan and skipped.`,
    });
  }
  if (added) addRouteDialog.value = false;
}

function removeRouteEntry(route) {
  planRoutes.value = planRoutes.value.filter((r) => r.key !== route.key);
  for (const p of products.value) {
    delete quantities[cellKey(p.id, route.key)];
  }
}

async function loadReferenceData() {
  try {
    const outletsParams = new URLSearchParams({ limit: 1000 });
    const [productsRes, staffRes, outletsRes] = await Promise.all([
      fetch("/productionPlans/products"),
      fetch("/staffs/picker"),
      fetch(`/outlets?${outletsParams}`),
    ]);
    products.value = await productsRes.json();
    const staffData = await staffRes.json();
    staffList.value = staffData.data || [];
    const outletData = await outletsRes.json();
    outletList.value = outletData.data || [];
  } catch (err) {
    console.error("Failed to load production plan reference data:", err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load products/staff/outlets.",
    });
  }
}

function resetGrid() {
  planRoutes.value = [];
  for (const key of Object.keys(quantities)) delete quantities[key];
  for (const key of Object.keys(staffSplits)) delete staffSplits[key];
}

async function loadPlan() {
  const iso = toISODateOnly(saleDate.value);
  if (!iso) return;

  resetGrid();
  try {
    const res = await fetch(`/productionPlans/${iso}`);
    const data = await res.json();

    planExists.value = !!data.plan.id;
    productionDate.value = formatDMY(data.plan.production_date);
    notes.value = data.plan.notes || "";

    const routeById = {};
    for (const r of data.routes) {
      const key = routeKey(r.staff_id, r.outlet_id);
      routeById[r.id] = key;
      planRoutes.value.push({
        key,
        staff_id: r.staff_id,
        staff_name: r.staff_name,
        outlet_id: r.outlet_id,
        outlet_name: r.outlet_name,
      });
    }

    for (const item of data.items) {
      const key = routeById[item.route_id];
      if (!key) continue;
      quantities[cellKey(item.product_id, key)] = Number(item.quantity);
    }
    for (const split of data.staffSplits) {
      if (!staffSplits[split.product_id]) staffSplits[split.product_id] = [];
      staffSplits[split.product_id].push({
        staff_id: split.staff_id,
        batches: Number(split.batches),
      });
    }
  } catch (err) {
    console.error("Failed to load production plan:", err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load production plan for that date.",
    });
  }
}

watch(saleDate, loadPlan);

async function savePlan() {
  const iso = toISODateOnly(saleDate.value);
  const prodIso = toISODateOnly(productionDate.value);
  if (!iso || !prodIso) {
    store.commit("setMessage", {
      type: "error",
      text: "Sale date and production date are required.",
    });
    return;
  }

  const routesPayload = planRoutes.value.map((r) => ({
    staff_id: r.staff_id,
    outlet_id: r.outlet_id,
  }));

  const items = [];
  for (const p of products.value) {
    for (const r of planRoutes.value) {
      const qty = Number(quantities[cellKey(p.id, r.key)]) || 0;
      if (qty > 0) {
        items.push({
          product_id: p.id,
          staff_id: r.staff_id,
          outlet_id: r.outlet_id,
          quantity: qty,
        });
      }
    }
  }

  const splits = [];
  for (const [productId, rows] of Object.entries(staffSplits)) {
    for (const row of rows) {
      if (row.staff_id && Number(row.batches) > 0) {
        splits.push({
          product_id: Number(productId),
          staff_id: row.staff_id,
          batches: Number(row.batches),
        });
      }
    }
  }

  saving.value = true;
  try {
    const res = await fetch(`/productionPlans/${iso}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        production_date: prodIso,
        notes: notes.value || null,
        routes: routesPayload,
        items,
        staffSplits: splits,
      }),
    });
    if (!res.ok) throw new Error("Save failed");
    planExists.value = true;
    store.commit("setMessage", {
      type: "success",
      text: "Production plan saved.",
    });
  } catch (err) {
    console.error("Failed to save production plan:", err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to save production plan.",
    });
  } finally {
    saving.value = false;
  }
}

async function deletePlan() {
  const iso = toISODateOnly(saleDate.value);
  if (!iso) return;
  deleting.value = true;
  try {
    await fetch(`/productionPlans/${iso}`, { method: "DELETE" });
    planExists.value = false;
    resetGrid();
    notes.value = "";
    store.commit("setMessage", {
      type: "success",
      text: "Production plan deleted.",
    });
  } catch (err) {
    console.error("Failed to delete production plan:", err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to delete production plan.",
    });
  } finally {
    deleting.value = false;
  }
}

async function openHistoryDialog() {
  historyDialog.value = true;
  historyLoading.value = true;
  try {
    const res = await fetch("/productionPlans");
    planHistory.value = await res.json();
  } catch (err) {
    console.error("Failed to load previous plans:", err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load previous plans.",
    });
  } finally {
    historyLoading.value = false;
  }
}

function selectHistoryPlan(plan) {
  saleDate.value = formatDMY(plan.sale_date);
  historyDialog.value = false;
}

onMounted(async () => {
  await loadReferenceData();
  await loadPlan();
});
</script>

<style scoped>
.table-scroll {
  overflow-x: auto;
}
.plan-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 700px;
}
.plan-table th,
.plan-table td {
  border: 1px solid #e0e0e0;
  padding: 6px 8px;
  vertical-align: middle;
}
.plan-table th {
  background: #fafafa;
  font-weight: 600;
}
.product-col {
  min-width: 130px;
  white-space: nowrap;
}
.total-col,
.mixer-col {
  min-width: 90px;
}
.split-row {
  border-bottom: 1px solid #eee;
}
.split-row:last-child {
  border-bottom: none;
}
</style>
