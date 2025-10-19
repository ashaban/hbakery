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
      <strong>Total Cost Types:</strong> {{ totals.total_types || "0" }}
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
          >Are you sure you want to delete {{ state.name }}?</v-card-text
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
const totals = reactive({ total_types: 0 });
const filters = reactive({ search: "" });
const categories = [
  "Production Cost",
  "Sale Cost",
  "Administrative Cost",
  "Other Cost",
];

const headers = [
  { title: "Name", key: "name" },
  { title: "Category", key: "category" },
  { title: "Actions", key: "actions", sortable: false, align: "center" },
];

const state = reactive({
  name: "",
  category: "",
});

// Validation rules
const rules = {
  name: { required },
  category: { required },
};
const v$ = useVuelidate(rules, state);

/* Load Cost Types */
async function loadValues() {
  loading.value = true;
  const params = new URLSearchParams({ page: page.value, limit });
  if (filters.search) params.append("search", filters.search);
  try {
    const res = await fetch(`/expenditures/types?${params}`);
    const data = await res.json();
    values.value = data.data || [];
    totalPages.value = data.totalPages || 1;
    totals.total_types = data.totalRecords || 0;
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
  page.value = 1;
  loadValues();
}

function activateAddDialog() {
  isEditing.value = false;
  Object.assign(state, { name: "", category: "" });
  dialog.value = true;
  v$.value.$reset();
}
async function activateEditDialog(item) {
  isEditing.value = true;
  editingId.value = item.id;
  Object.assign(state, {
    name: item.name,
    category: item.category,
  });
  dialog.value = true;
}

/* Save */
async function saveType() {
  v$.value.$touch();
  if (v$.value.$invalid) return;
  loading.value = true;
  try {
    const payload = { name: state.name, category: state.category };
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
</style>
