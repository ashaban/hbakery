<template>
  <v-container class="py-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="d-flex align-center justify-space-between">
        <div>
          <h2 class="text-h5 font-weight-bold text-primary mb-1">
            Expenditure Management
          </h2>
          <p class="text-body-2 text-grey">
            Monitor and manage operational and sales costs
          </p>
        </div>
        <v-btn
          color="primary"
          prepend-icon="mdi-plus-circle"
          @click="openDialog(false)"
        >
          New Expenditure
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- SUMMARY CARDS -->
    <v-row class="mb-4">
      <v-col cols="12" md="4">
        <v-card class="pa-4" elevation="3" rounded="xl">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-body-2 text-grey">Total Expenditure</div>
              <div class="text-h6 font-weight-bold">
                {{ formatCurrency(summary.total_expenditure) }}
              </div>
            </div>
            <v-avatar color="primary" size="40" variant="tonal">
              <v-icon color="primary">mdi-cash</v-icon>
            </v-avatar>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4" elevation="3" rounded="xl">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-body-2 text-grey">Production Costs</div>
              <div class="text-h6 font-weight-bold text-blue">
                {{ formatCurrency(summary.total_production_cost) }}
              </div>
            </div>
            <v-avatar color="blue" size="40" variant="tonal">
              <v-icon color="blue">mdi-factory</v-icon>
            </v-avatar>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4" elevation="3" rounded="xl">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-body-2 text-grey">Sale Costs</div>
              <div class="text-h6 font-weight-bold text-green">
                {{ formatCurrency(summary.total_sale_cost) }}
              </div>
            </div>
            <v-avatar color="green" size="40" variant="tonal">
              <v-icon color="green">mdi-sale</v-icon>
            </v-avatar>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- FILTERS -->
    <v-card class="mb-4" elevation="2" rounded="lg">
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="4">
            <v-autocomplete
              v-model="filters.type_ids"
              autocomplete="off"
              autocorrect="off"
              chips
              clearable
              color="primary"
              inputmode="none"
              item-title="name"
              item-value="id"
              :items="costTypes"
              label="Filter by Cost Types"
              multiple
              spellcheck="false"
              variant="outlined"
            />
          </v-col>

          <v-col cols="12" md="4">
            <v-card-subtitle class="pl-0 pb-1 text-caption text-grey">
              Start Date Range
            </v-card-subtitle>
            <div class="d-flex gap-2">
              <VueDatePicker
                v-model="filters.start_from"
                auto-apply
                class="flex-1 border rounded-lg px-2 py-1"
                format="dd-MM-yyyy"
                model-type="format"
                placeholder="From"
                :teleport="true"
              />
              <VueDatePicker
                v-model="filters.start_to"
                auto-apply
                class="flex-1 border rounded-lg px-2 py-1"
                format="dd-MM-yyyy"
                model-type="format"
                placeholder="To"
                :teleport="true"
              />
            </div>
          </v-col>

          <v-col cols="12" md="4">
            <v-card-subtitle class="pl-0 pb-1 text-caption text-grey"
              >End Date Range</v-card-subtitle
            >
            <div class="d-flex gap-2">
              <VueDatePicker
                v-model="filters.end_from"
                auto-apply
                class="flex-1 border rounded-lg px-2 py-1"
                format="dd-MM-yyyy"
                model-type="format"
                placeholder="From"
                :teleport="true"
              />
              <VueDatePicker
                v-model="filters.end_to"
                auto-apply
                class="flex-1 border rounded-lg px-2 py-1"
                format="dd-MM-yyyy"
                model-type="format"
                placeholder="To"
                :teleport="true"
              />
            </div>
          </v-col>
        </v-row>

        <div class="d-flex justify-end mt-4">
          <v-btn color="primary" prepend-icon="mdi-filter" @click="loadData">
            Apply Filters
          </v-btn>
          <v-btn
            class="ml-2"
            prepend-icon="mdi-close-circle"
            variant="outlined"
            @click="clearFilters"
          >
            Clear
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- TABLE -->
    <v-card elevation="2" rounded="lg">
      <v-card-text class="pa-0">
        <v-data-table
          class="rounded-lg"
          density="comfortable"
          :headers="headers"
          hover
          :items="expenditures"
          :loading="loading"
        >
          <template #loading>
            <v-skeleton-loader type="table-row@10" />
          </template>

          <template #item.amount="{ item }">
            <v-chip color="green" variant="flat">
              {{ formatCurrency(item.amount) }}
            </v-chip>
          </template>

          <template #item.cost_category="{ item }">
            <v-chip
              :color="getCategoryColor(item.cost_category)"
              variant="outlined"
            >
              {{ item.cost_category }}
            </v-chip>
          </template>

          <template #item.start_date="{ item }">
            {{ formatDate(item.start_date) }}
          </template>
          <template #item.end_date="{ item }">
            {{ formatDate(item.end_date) }}
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex justify-center">
              <v-tooltip location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    color="blue"
                    icon
                    size="small"
                    variant="text"
                    @click="openDialog(true, item)"
                  >
                    <v-icon>mdi-pencil</v-icon>
                  </v-btn>
                </template>
                <span>Edit</span>
              </v-tooltip>
              <v-tooltip location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    color="red"
                    icon
                    size="small"
                    variant="text"
                    @click="deleteExpenditure(item)"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </template>
                <span>Delete</span>
              </v-tooltip>
            </div>
          </template>

          <template #no-data>
            <div class="text-center py-6 text-grey">
              <v-icon color="grey-lighten-2" size="48">mdi-inbox</v-icon>
              <div>No expenditures found</div>
            </div>
          </template>
        </v-data-table>

        <v-divider />
        <div class="d-flex justify-space-between align-center pa-4">
          <span class="text-caption text-grey">
            Showing {{ expenditures.length }} of {{ totalRecords }} records
          </span>
          <v-pagination
            v-model="page"
            color="primary"
            :length="totalPages"
            :total-visible="7"
            @update:model-value="loadData"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- ADD/EDIT DIALOG -->
    <v-dialog v-model="dialog" max-width="600px" persistent>
      <v-card>
        <v-toolbar class="text-white" color="primary" density="comfortable">
          <v-toolbar-title>{{
            editMode ? "Edit Expenditure" : "New Expenditure"
          }}</v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="closeDialog"
          />
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-form ref="formRef" @submit.prevent="saveExpenditure">
            <v-autocomplete
              v-model="form.type_id"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="errors.type_id"
              inputmode="none"
              item-title="name"
              item-value="id"
              :items="costTypes"
              label="Cost Type *"
              required
              spellcheck="false"
              variant="outlined"
              @blur="validateField('type_id')"
              @input="clearError('type_id')"
            >
              <template #label>
                <span class="required-field">Cost Type</span>
              </template>
            </v-autocomplete>

            <v-row dense>
              <v-col cols="12" md="6">
                <div class="d-flex flex-column">
                  <label class="text-caption text-grey mb-1 required-field"
                    >Start Date *</label
                  >
                  <VueDatePicker
                    v-model="form.start_date"
                    auto-apply
                    :class="[
                      'rounded-lg',
                      'border',
                      'px-4',
                      'py-2',
                      'w-100',
                      errors.start_date ? 'error-field' : '',
                    ]"
                    format="dd-MM-yyyy"
                    model-type="format"
                    placeholder="Start Date"
                    :teleport="true"
                    @blur="validateField('start_date')"
                    @update:model-value="clearError('start_date')"
                  />
                  <div
                    v-if="errors.start_date"
                    class="text-caption text-error mt-1"
                  >
                    {{ errors.start_date }}
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="d-flex flex-column">
                  <label class="text-caption text-grey mb-1 required-field"
                    >End Date *</label
                  >
                  <VueDatePicker
                    v-model="form.end_date"
                    auto-apply
                    :class="[
                      'rounded-lg',
                      'border',
                      'px-4',
                      'py-2',
                      'w-100',
                      errors.end_date ? 'error-field' : '',
                    ]"
                    format="dd-MM-yyyy"
                    model-type="format"
                    placeholder="End Date"
                    :teleport="true"
                    @blur="validateField('end_date')"
                    @update:model-value="validateDateRange()"
                  />
                  <div
                    v-if="errors.end_date"
                    class="text-caption text-error mt-1"
                  >
                    {{ errors.end_date }}
                  </div>
                </div>
              </v-col>
            </v-row>

            <v-text-field
              v-model.number="form.amount"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="errors.amount"
              inputmode="none"
              label="Amount *"
              prefix="$"
              required
              spellcheck="false"
              type="number"
              variant="outlined"
              @blur="validateField('amount')"
              @input="clearError('amount')"
            >
              <template #label>
                <span class="required-field">Amount</span>
              </template>
            </v-text-field>

            <v-textarea
              v-model="form.description"
              color="primary"
              label="Description"
              rows="3"
              variant="outlined"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn color="grey" variant="outlined" @click="closeDialog"
            >Cancel</v-btn
          >
          <v-btn color="primary" :loading="saving" @click="saveExpenditure">
            <v-icon start>mdi-content-save</v-icon>
            {{ editMode ? "Update" : "Save" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SNACKBAR FOR NOTIFICATIONS -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="3000">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import moment from "moment";

/* STATE */
const expenditures = ref([]);
const costTypes = ref([]);
const formRef = ref(null);
const filters = reactive({
  type_ids: [],
  start_from: "",
  start_to: "",
  end_from: "",
  end_to: "",
});
const summary = reactive({
  total_expenditure: 0,
  total_production_cost: 0,
  total_sale_cost: 0,
});
const page = ref(1);
const totalPages = ref(1);
const totalRecords = ref(0);
const dialog = ref(false);
const editMode = ref(false);
const loading = ref(false);
const saving = ref(false);
const form = reactive({
  id: null,
  type_id: "",
  start_date: "",
  end_date: "",
  amount: "",
  description: "",
});
const errors = reactive({
  type_id: "",
  start_date: "",
  end_date: "",
  amount: "",
});
const snackbar = reactive({
  show: false,
  message: "",
  color: "success",
});

/* TABLE HEADERS */
const headers = [
  { title: "Cost Type", key: "cost_type" },
  { title: "Category", key: "cost_category" },
  { title: "Start Date", key: "start_date" },
  { title: "End Date", key: "end_date" },
  { title: "Amount", key: "amount", align: "end" },
  { title: "Description", key: "description" },
  { title: "Actions", key: "actions", align: "center", sortable: false },
];

/* UTILITIES */
function formatCurrency(val) {
  return Number(val || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  });
}

function formatDate(date) {
  if (!date) return "";
  return moment(date, "YYYY-MM-DD").format("DD-MM-YYYY");
}

function clearFilters() {
  Object.assign(filters, {
    type_ids: [],
    start_from: "",
    start_to: "",
    end_from: "",
    end_to: "",
  });
  loadData();
}

function getCategoryColor(category) {
  const colors = {
    "Production Cost": "blue-lighten-1",
    "Sale Cost": "green-lighten-1",
    "Administrative Cost": "purple-lighten-4",
    "Other Cost": "orange-lighten-4",
  };
  return colors[category] || "grey-lighten-3";
}

function showSnackbar(message, color = "success") {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

/* VALIDATIONS */
function validateField(field) {
  switch (field) {
    case "type_id":
      errors.type_id = !form.type_id ? "Cost type is required" : "";
      break;
    case "start_date":
      errors.start_date = !form.start_date ? "Start date is required" : "";
      break;
    case "end_date":
      errors.end_date = !form.end_date ? "End date is required" : "";
      if (form.start_date && form.end_date) {
        validateDateRange();
      }
      break;
    case "amount":
      if (!form.amount && form.amount !== 0) {
        errors.amount = "Amount is required";
      } else if (!Number.isInteger(Number(form.amount))) {
        errors.amount = "Amount must be a whole number";
      } else if (form.amount < 0) {
        errors.amount = "Amount must be positive";
      } else {
        errors.amount = "";
      }
      break;
  }
}

function validateDateRange() {
  if (form.start_date && form.end_date) {
    const start = moment(form.start_date, "DD-MM-YYYY");
    const end = moment(form.end_date, "DD-MM-YYYY");
    if (end.isBefore(start)) {
      errors.end_date = "End date cannot be before start date";
    } else {
      clearError("end_date");
    }
  }
}

function clearError(field) {
  errors[field] = "";
}

function validateForm() {
  validateField("type_id");
  validateField("start_date");
  validateField("end_date");
  validateField("amount");

  return (
    !errors.type_id && !errors.start_date && !errors.end_date && !errors.amount
  );
}

/* LOADERS */
async function loadCostTypes() {
  try {
    const res = await fetch("/expenditures/types");
    const data = await res.json();
    costTypes.value = data.data;
  } catch (err) {
    console.error("Failed to load cost types:", err);
    showSnackbar("Failed to load cost types", "error");
  }
}

async function loadSummary() {
  try {
    const params = new URLSearchParams();
    if (filters.type_ids.length)
      filters.type_ids.forEach((t) => params.append("type_id", t));
    if (filters.start_from)
      params.append("start_date_from", filters.start_from);
    if (filters.start_to) params.append("start_date_to", filters.start_to);
    if (filters.end_from) params.append("end_date_from", filters.end_from);
    if (filters.end_to) params.append("end_date_to", filters.end_to);
    const res = await fetch(`/expenditures/summary?${params.toString()}`);
    const data = await res.json();
    Object.assign(summary, data);
  } catch (err) {
    console.error("Failed to load summary:", err);
  }
}

async function loadData() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filters.type_ids.length)
      filters.type_ids.forEach((t) => params.append("type_id", t));
    if (filters.start_from)
      params.append("start_date_from", filters.start_from);
    if (filters.start_to) params.append("start_date_to", filters.start_to);
    if (filters.end_from) params.append("end_date_from", filters.end_from);
    if (filters.end_to) params.append("end_date_to", filters.end_to);
    params.append("page", page.value);
    params.append("limit", 10);
    const res = await fetch(`/expenditures?${params.toString()}`);
    const data = await res.json();
    expenditures.value = data.data || [];
    totalPages.value = data.totalPages || 1;
    totalRecords.value = data.totalRecords || 0;
    await loadSummary();
  } catch (err) {
    console.error("Failed to load expenditures:", err);
    showSnackbar("Failed to load expenditures", "error");
  } finally {
    loading.value = false;
  }
}

/* CRUD */
function openDialog(edit = false, item = null) {
  editMode.value = edit;
  dialog.value = true;
  // Clear previous errors
  Object.keys(errors).forEach((key) => (errors[key] = ""));

  if (edit && item) {
    Object.assign(form, {
      id: item.id,
      type_id: item.type_id,
      start_date: moment(item.start_date, "YYYY-MM-DD").format("DD-MM-YYYY"),
      end_date: moment(item.end_date, "YYYY-MM-DD").format("DD-MM-YYYY"),
      amount: item.amount,
      description: item.description,
    });
  } else {
    Object.assign(form, {
      id: null,
      type_id: "",
      start_date: "",
      end_date: "",
      amount: "",
      description: "",
    });
  }
}

function closeDialog() {
  dialog.value = false;
  // Clear errors when closing
  Object.keys(errors).forEach((key) => (errors[key] = ""));
}

async function saveExpenditure() {
  if (!validateForm()) {
    showSnackbar("Please fix the validation errors", "error");
    return;
  }

  saving.value = true;
  try {
    const method = editMode.value ? "PUT" : "POST";
    const url = editMode.value ? `/expenditures/${form.id}` : "/expenditures";

    // Prepare data for API
    console.log(JSON.stringify(form, 0, 2));
    const payload = {
      ...form,
      start_date: moment(form.start_date, "DD-MM-YYYY").format("YYYY-MM-DD"),
      end_date: moment(form.end_date, "DD-MM-YYYY").format("YYYY-MM-DD"),
    };
    console.log(JSON.stringify(payload, 0, 2));

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Save failed");
    }

    dialog.value = false;
    showSnackbar(
      `Expenditure ${editMode.value ? "updated" : "created"} successfully`,
    );
    await loadData();
  } catch (err) {
    console.error("Failed to save expenditure:", err);
    showSnackbar(err.message || "Failed to save expenditure", "error");
  } finally {
    saving.value = false;
  }
}

async function deleteExpenditure(item) {
  if (
    !confirm(`Are you sure you want to delete expenditure "${item.cost_type}"?`)
  )
    return;

  try {
    const res = await fetch(`/expenditures/${item.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");

    showSnackbar("Expenditure deleted successfully");
    await loadData();
  } catch (err) {
    console.error("Failed to delete expenditure:", err);
    showSnackbar("Failed to delete expenditure", "error");
  }
}

onMounted(async () => {
  await loadCostTypes();
  await loadData();
});
</script>

<style scoped>
.border {
  border: 1px solid #ccc;
}
.gap-2 {
  gap: 8px;
}
.required-field::after {
  content: " *";
  color: red;
}
.error-field {
  border-color: #ff5252 !important;
  border-width: 2px !important;
}
.text-error {
  color: #ff5252;
}
</style>
