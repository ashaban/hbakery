<template>
  <v-container fluid>
    <!-- 🔍 FILTERS -->
    <v-card class="pa-4 mb-4">
      <v-row dense>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="filters.search"
            append-inner-icon="mdi-close-circle"
            clearable
            label="Search Outlet Name"
            @click:append-inner="filters.search = ''"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="filters.type"
            clearable
            :items="typeOptions"
            label="Filter by Type"
          />
        </v-col>
        <v-col class="d-flex justify-end" cols="12">
          <v-btn color="primary" @click="applyFilters">
            <v-icon start>mdi-filter</v-icon> Apply
          </v-btn>
          <v-btn class="ml-2" color="grey" @click="resetFilters">
            <v-icon start>mdi-refresh</v-icon> Reset
          </v-btn>
        </v-col>
      </v-row>
    </v-card>

    <!-- 🧾 TOTAL SUMMARY -->
    <v-alert border="start" class="mb-4" type="info" variant="outlined">
      <div class="d-flex justify-space-between align-center">
        <div>
          <strong>Total Outlets:</strong> {{ totals.total_outlets || "0" }}
        </div>
        <div v-if="typeCounts.byType" class="d-flex gap-4">
          <span
            v-for="type in typeCounts.byType"
            :key="type.type"
            class="text-caption"
          >
            <v-chip class="mr-1" :color="getTypeColor(type.type)" size="small">
              {{ type.count }}
            </v-chip>
            {{ type.type }}
          </span>
        </div>
      </div>
    </v-alert>

    <!-- 📋 HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h3>Outlets</h3>
      <v-btn
        class="text-white"
        color="primary"
        size="small"
        @click="activateAddDialog"
      >
        <v-icon start>mdi-plus</v-icon> Add Outlet
      </v-btn>
    </div>

    <!-- LOADING BAR -->
    <v-progress-linear :active="loading" :indeterminate="loading" />

    <!-- TABLE -->
    <v-data-table
      class="elevation-1"
      dense
      :headers="headers"
      height="400"
      :items="values"
      :loading="loading"
    >
      <template #item.type="{ item }">
        <v-chip :color="getTypeColor(item.type)" size="small" variant="flat">
          {{ item.type }}
        </v-chip>
      </template>

      <template #item.is_main="{ item }">
        <v-icon v-if="item.is_main" color="success" size="small">
          mdi-check-circle
        </v-icon>
        <v-icon v-else color="grey" size="small"> mdi-circle-outline </v-icon>
      </template>

      <template #item.is_active="{ item }">
        <v-icon v-if="item.is_active" color="success" size="small">
          mdi-check-circle
        </v-icon>
        <v-icon v-else color="error" size="small"> mdi-close-circle </v-icon>
      </template>

      <template #item.actions="{ item }">
        <v-icon class="mr-2" color="primary" @click="activateEditDialog(item)">
          mdi-square-edit-outline
        </v-icon>
        <v-icon
          color="error"
          :disabled="item.is_main"
          @click="activateDeleteDialog(item)"
        >
          mdi-delete
        </v-icon>
      </template>
    </v-data-table>

    <!-- PAGINATION -->
    <div class="d-flex justify-end align-center mt-4">
      <v-pagination
        v-model="page"
        :length="totalPages"
        total-visible="7"
        @update:model-value="loadValues"
      />
    </div>

    <!-- ADD / EDIT OUTLET DIALOG -->
    <v-dialog
      v-model="dialog"
      max-width="600"
      transition="dialog-top-transition"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-store</v-icon>
            <span class="text-white font-weight-bold text-h6">
              {{ isEditing ? "Edit Outlet" : "Add Outlet" }}
            </span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="dialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="state.name"
                  bg-color="#E0E0E0"
                  :error-messages="v$.name.$errors.map((e) => e.$message)"
                  label="Outlet Name"
                  required
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="state.type"
                  bg-color="#E0E0E0"
                  :error-messages="v$.type.$errors.map((e) => e.$message)"
                  :items="typeOptions"
                  label="Outlet Type"
                  required
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="state.location"
                  bg-color="#E0E0E0"
                  label="Location"
                  rows="2"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="state.is_main"
                  color="primary"
                  :disabled="isEditing && !state.is_main"
                  label="Main Outlet"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-checkbox
                  v-model="state.is_active"
                  color="success"
                  label="Active"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end mt-2">
          <v-btn
            color="success"
            :disabled="v$.$invalid"
            :loading="loading"
            @click="saveOutlet"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ isEditing ? "Save Changes" : "Add Outlet" }}
          </v-btn>
          <v-btn
            v-if="isEditing"
            color="error"
            :disabled="state.is_main"
            @click="confirmDeleteDialog = true"
          >
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CONFIRM DELETE DIALOG -->
    <v-dialog v-model="confirmDeleteDialog" persistent width="400">
      <v-card>
        <v-toolbar color="warning" :title="'Confirm Deleting ' + state.name">
          <v-btn
            color="white"
            icon="mdi-close"
            @click="confirmDeleteDialog = false"
          />
        </v-toolbar>
        <v-card-text>
          Are you sure you want to delete {{ state.name }}?
          <v-alert v-if="state.is_main" class="mt-2" dense type="error">
            Cannot delete main outlet. Set another outlet as main first.
          </v-alert>
        </v-card-text>
        <v-card-actions class="d-flex justify-end">
          <v-btn color="grey" @click="confirmDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn
            color="error"
            :disabled="state.is_main"
            :loading="loading"
            @click="removeOutlet"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";

const store = useStore();
const loading = ref(false);
const values = ref([]);
const dialog = ref(false);
const confirmDeleteDialog = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const page = ref(1);
const totalPages = ref(1);
const limit = 10;
const totals = reactive({ total_outlets: "" });
const typeCounts = reactive({ total: 0, byType: [] });

const filters = reactive({
  search: "",
  type: "",
});

const typeOptions = [
  { title: "Main Branch", value: "MAIN" },
  { title: "Shop", value: "SHOP" },
  { title: "Car", value: "CAR" },
];

const headers = [
  { title: "Name", key: "name" },
  { title: "Type", key: "type" },
  { title: "Location", key: "location" },
  { title: "Main Outlet", key: "is_main", align: "center" },
  { title: "Active", key: "is_active", align: "center" },
  { title: "Created", key: "created_at" },
  { title: "Actions", key: "actions", sortable: false },
];

const state = reactive({
  name: "",
  type: "",
  location: "",
  is_main: false,
  is_active: true,
});

// Validation rules
const rules = {
  name: { required },
  type: { required },
};
const v$ = useVuelidate(rules, state);

// Computed
const getTypeColor = (type) => {
  const colors = {
    MAIN: "primary",
    SHOP: "success",
    CAR: "warning",
  };
  return colors[type] || "grey";
};

// Data functions
async function loadValues() {
  loading.value = true;
  const params = new URLSearchParams({ page: page.value, limit });
  if (filters.search) params.append("search", filters.search);
  if (filters.type) params.append("type", filters.type);

  try {
    const res = await fetch(`/outlets?${params}`);
    if (!res.ok) throw new Error("Failed to fetch outlets");

    const data = await res.json();
    values.value = data.data || [];
    totalPages.value = data.totalPages || 1;
    totals.total_outlets = data.totalRecords || 0;
  } catch (error) {
    console.error("Error loading outlets:", error);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load outlets",
    });
  } finally {
    loading.value = false;
  }
}

async function loadTypeCounts() {
  try {
    const res = await fetch("/outlets/types/count");
    if (res.ok) {
      const data = await res.json();
      Object.assign(typeCounts, data);
    }
  } catch (error) {
    console.error("Error loading type counts:", error);
  }
}

// Filters
function applyFilters() {
  page.value = 1;
  loadValues();
  loadTypeCounts();
}

function resetFilters() {
  filters.search = "";
  filters.type = "";
  page.value = 1;
  loadValues();
  loadTypeCounts();
}

// Dialog control
function activateAddDialog() {
  isEditing.value = false;
  Object.assign(state, {
    name: "",
    type: "",
    location: "",
    is_main: false,
    is_active: true,
  });
  dialog.value = true;
  v$.value.$reset();
}

async function activateEditDialog(item) {
  isEditing.value = true;
  editingId.value = item.id;
  loading.value = true;

  try {
    const res = await fetch(`/outlets/${item.id}`);
    if (!res.ok) throw new Error("Failed to fetch outlet");

    const data = await res.json();
    Object.assign(state, data.outlet);
    dialog.value = true;
  } catch (error) {
    console.error("Error loading outlet:", error);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load outlet",
    });
  } finally {
    loading.value = false;
  }
}

function activateDeleteDialog(item) {
  editingId.value = item.id;
  state.name = item.name;
  state.is_main = item.is_main;
  confirmDeleteDialog.value = true;
}

// Save & delete
async function saveOutlet() {
  v$.value.$touch();
  if (v$.value.$invalid) return;

  loading.value = true;

  const url = isEditing.value ? `/outlets/${editingId.value}` : "/outlets";
  const method = isEditing.value ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to save outlet");
    }

    dialog.value = false;
    loadValues();
    loadTypeCounts();

    store.commit("setMessage", {
      type: "success",
      text: isEditing.value ? "Outlet updated!" : "Outlet added!",
    });
  } catch (error) {
    console.error("Error saving outlet:", error);
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to save outlet",
    });
  } finally {
    loading.value = false;
  }
}

async function removeOutlet() {
  loading.value = true;

  try {
    const res = await fetch(`/outlets/${editingId.value}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to delete outlet");
    }

    confirmDeleteDialog.value = false;
    dialog.value = false;
    loadValues();
    loadTypeCounts();

    store.commit("setMessage", { type: "success", text: "Outlet deleted!" });
  } catch (error) {
    console.error("Error deleting outlet:", error);
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to delete outlet",
    });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadValues();
  loadTypeCounts();
});
</script>

<style scoped>
.v-alert strong {
  font-weight: 600;
}

.gap-4 {
  gap: 16px;
}
</style>
