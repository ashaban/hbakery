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
            label="Search Cost Type"
            @click:append-inner="filters.search = ''"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="filters.category"
            clearable
            :items="categories"
            label="Filter by Category"
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="filters.affects_margin"
            clearable
            item-title="text"
            item-value="value"
            :items="marginOptions"
            label="Filter by Margin Effect"
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
      <div class="d-flex justify-space-between flex-wrap">
        <div>
          <strong>Total Cost Types:</strong> {{ totals.total_types || "0" }}
        </div>
        <div>
          <strong>Affects Margin:</strong> {{ totals.affects_margin || "0" }}
        </div>
        <div>
          <strong>Doesn't Affect Margin:</strong>
          {{ totals.no_affect_margin || "0" }}
        </div>
      </div>
    </v-alert>

    <!-- 📋 HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h3>Cost Types</h3>
      <v-btn
        class="text-white"
        color="primary"
        size="small"
        @click="activateAddDialog"
      >
        <v-icon start>mdi-plus</v-icon> Add Cost Type
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
      <template #item.affects_margin="{ item }">
        <v-chip
          :color="item.affects_margin === 'Yes' ? 'success' : 'grey'"
          size="small"
        >
          {{ item.affects_margin === "Yes" ? "Affects Margin" : "No Effect" }}
        </v-chip>
      </template>

      <template #item.category="{ item }">
        <v-chip
          :color="getCategoryColor(item.category)"
          size="small"
          variant="outlined"
        >
          {{ item.category }}
        </v-chip>
      </template>

      <template #item.actions="{ item }">
        <v-icon class="mr-2" color="primary" @click="activateEditDialog(item)">
          mdi-square-edit-outline
        </v-icon>
        <v-icon color="error" @click="confirmDelete(item)"> mdi-delete </v-icon>
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

    <!-- ADD / EDIT DIALOG -->
    <v-dialog
      v-model="dialog"
      max-width="600"
      transition="dialog-top-transition"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-tag-text</v-icon>
            <span class="text-white font-weight-bold text-h6">
              {{ isEditing ? "Edit Cost Type" : "Add Cost Type" }}
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
                  label="Cost Type Name"
                  required
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="state.category"
                  bg-color="#E0E0E0"
                  :error-messages="v$.category.$errors.map((e) => e.$message)"
                  :items="categories"
                  label="Category"
                  required
                />
              </v-col>
              <v-col cols="12">
                <v-select
                  v-model="state.affects_margin"
                  bg-color="#E0E0E0"
                  :error-messages="
                    v$.affects_margin.$errors.map((e) => e.$message)
                  "
                  hint="Select 'Yes' if this cost type should be deducted from gross margin"
                  item-title="text"
                  item-value="value"
                  :items="marginOptions"
                  label="Affects Margin Calculation"
                  persistent-hint
                  required
                />
              </v-col>
              <v-col v-if="state.affects_margin === 'Yes'" cols="12">
                <v-alert density="compact" type="info" variant="outlined">
                  <small
                    >This cost type will be included in net margin calculations
                    and deducted from gross margin.</small
                  >
                </v-alert>
              </v-col>
              <v-col v-if="state.affects_margin === 'No'" cols="12">
                <v-alert density="compact" type="warning" variant="outlined">
                  <small
                    >This cost type will NOT affect margin calculations and will
                    be excluded from net margin.</small
                  >
                </v-alert>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end mt-2">
          <v-btn
            color="success"
            :disabled="v$.$invalid"
            :loading="loading"
            @click="saveType"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ isEditing ? "Save Changes" : "Add Cost Type" }}
          </v-btn>
          <v-btn
            v-if="isEditing"
            color="error"
            @click="confirmDeleteDialog = true"
          >
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- CONFIRM DELETE -->
    <v-dialog v-model="confirmDeleteDialog" persistent width="400">
      <v-card>
        <v-toolbar color="warning" :title="'Confirm Deleting ' + state.name">
          <v-btn
            color="white"
            icon="mdi-close"
            @click="confirmDeleteDialog = false"
          />
        </v-toolbar>
        <v-card-text
          >Are you sure you want to delete "{{ state.name }}"? This action
          cannot be undone.</v-card-text
        >
        <v-card-actions class="d-flex justify-end">
          <v-btn color="grey" @click="confirmDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn color="error" @click="removeType">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";

const loading = ref(false);
const values = ref([]);
const dialog = ref(false);
const confirmDeleteDialog = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const page = ref(1);
const totalPages = ref(1);
const limit = 10;
const totals = reactive({
  total_types: 0,
  affects_margin: 0,
  no_affect_margin: 0,
});

const filters = reactive({
  search: "",
  category: "",
  affects_margin: "",
});

const categories = [
  "Production Cost",
  "Sale Cost",
  "Administrative Cost",
  "Other Cost",
];

const marginOptions = [
  { text: "Yes - Affects Margin", value: "Yes" },
  { text: "No - Doesn't Affect Margin", value: "No" },
];

const headers = [
  { title: "Name", key: "name" },
  { title: "Category", key: "category" },
  { title: "Affects Margin", key: "affects_margin", align: "center" },
  { title: "Created Date", key: "created_at" },
  { title: "Actions", key: "actions", sortable: false, align: "center" },
];

const state = reactive({
  name: "",
  category: "",
  affects_margin: "Yes", // Default to "Yes"
});

// Validation rules
const rules = {
  name: { required },
  category: { required },
  affects_margin: { required },
};
const v$ = useVuelidate(rules, state);

// Helper function to get category color
const getCategoryColor = (category) => {
  const colors = {
    "Production Cost": "blue",
    "Sale Cost": "green",
    "Administrative Cost": "orange",
    "Other Cost": "grey",
  };
  return colors[category] || "grey";
};

/* Load Cost Types */
async function loadValues() {
  loading.value = true;
  const params = new URLSearchParams({ page: page.value, limit });

  if (filters.search) params.append("search", filters.search);
  if (filters.category) params.append("category", filters.category);
  if (filters.affects_margin)
    params.append("affects_margin", filters.affects_margin);

  try {
    const res = await fetch(`/expenditures/types?${params}`);
    const data = await res.json();
    values.value = data.data || [];
    totalPages.value = data.totalPages || 1;
    totals.total_types = data.totalRecords || 0;

    // Calculate margin statistics
    if (data.data) {
      totals.affects_margin = data.data.filter(
        (item) => item.affects_margin === "Yes",
      ).length;
      totals.no_affect_margin = data.data.filter(
        (item) => item.affects_margin === "No",
      ).length;
    }
  } catch (err) {
    console.error("Failed to load cost types", err);
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  page.value = 1;
  loadValues();
}

function resetFilters() {
  filters.search = "";
  filters.category = "";
  filters.affects_margin = "";
  page.value = 1;
  loadValues();
}

function activateAddDialog() {
  isEditing.value = false;
  Object.assign(state, {
    name: "",
    category: "",
    affects_margin: "Yes",
  });
  dialog.value = true;
  v$.value.$reset();
}

async function activateEditDialog(item) {
  isEditing.value = true;
  editingId.value = item.id;
  Object.assign(state, {
    name: item.name,
    category: item.category,
    affects_margin: item.affects_margin,
  });
  dialog.value = true;
}

/* Save */
async function saveType() {
  v$.value.$touch();
  if (v$.value.$invalid) return;
  loading.value = true;
  try {
    const payload = {
      name: state.name,
      category: state.category,
      affects_margin: state.affects_margin,
    };
    const method = isEditing.value ? "PUT" : "POST";
    const url = isEditing.value
      ? `/expenditures/types/${editingId.value}`
      : "/expenditures/types";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to save");
    dialog.value = false;
    loadValues();
  } finally {
    loading.value = false;
  }
}

/* Delete */
const toDelete = ref(null);
function confirmDelete(item) {
  toDelete.value = item;
  Object.assign(state, {
    name: item.name,
    category: item.category,
    affects_margin: item.affects_margin,
  });
  confirmDeleteDialog.value = true;
}

async function removeType() {
  loading.value = true;
  try {
    await fetch(`/expenditures/types/${toDelete.value.id}`, {
      method: "DELETE",
    });
    confirmDeleteDialog.value = false;
    loadValues();
  } catch (err) {
    console.error("Failed to delete", err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadValues();
});
</script>

<style scoped>
.v-alert strong {
  font-weight: 600;
}

.v-alert .d-flex > div {
  margin-right: 20px;
}

.v-alert .d-flex > div:last-child {
  margin-right: 0;
}
</style>
