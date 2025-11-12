<template>
  <v-container class="py-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2" rounded="lg">
      <v-card-text class="d-flex align-center justify-space-between">
        <div>
          <h2 class="text-h5 font-weight-bold text-primary mb-1">
            Purchase Management
          </h2>
          <p class="text-body-2 text-grey">
            Track and manage inventory purchases and costs
          </p>
        </div>
        <v-btn
          color="primary"
          prepend-icon="mdi-cart-plus"
          @click="openAddDialog"
        >
          New Purchase
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- SUMMARY CARDS -->
    <v-row class="mb-4">
      <v-col cols="12" md="4">
        <v-card class="pa-4" elevation="3" rounded="xl">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-body-2 text-grey">Total Purchases</div>
              <div class="text-h6 font-weight-bold">
                {{ formatCurrency(totals.total_amount) }}
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
              <div class="text-body-2 text-grey">Total Quantity</div>
              <div class="text-h6 font-weight-bold text-blue">
                {{ parseFloat(totals.total_quantity) || 0 }}
              </div>
            </div>
            <v-avatar color="blue" size="40" variant="tonal">
              <v-icon color="blue">mdi-package-variant</v-icon>
            </v-avatar>
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4" elevation="3" rounded="xl">
          <div class="d-flex align-center justify-space-between">
            <div>
              <div class="text-body-2 text-grey">Avg. Unit Price</div>
              <div class="text-h6 font-weight-bold text-green">
                {{ formatCurrency(avgUnitPrice) }}
              </div>
            </div>
            <v-avatar color="green" size="40" variant="tonal">
              <v-icon color="green">mdi-tag</v-icon>
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
              v-model="filters.item_id"
              autocomplete="off"
              autocorrect="off"
              clearable
              color="primary"
              inputmode="none"
              item-title="name"
              item-value="id"
              :items="items"
              label="Filter by Item"
              spellcheck="false"
              variant="outlined"
            />
          </v-col>

          <v-col cols="12" md="3">
            <v-select
              v-model="filters.date_operator"
              clearable
              item-title="label"
              item-value="value"
              :items="dateOperators"
              label="Date Filter"
              variant="outlined"
            />
          </v-col>

          <v-col cols="12" md="5">
            <template
              v-if="filters.date_operator && filters.date_operator !== 'in'"
            >
              <v-card-subtitle class="pl-0 pb-1 text-caption text-grey">
                Select Date
              </v-card-subtitle>
              <VueDatePicker
                v-model="filters.date"
                auto-apply
                class="border rounded-lg px-4 py-2"
                format="dd-MM-yyyy"
                model-type="format"
                placeholder="Select Date"
                :teleport="true"
              />
            </template>

            <template v-if="filters.date_operator === 'in'">
              <v-card-subtitle class="pl-0 pb-1 text-caption text-grey">
                Date Range
              </v-card-subtitle>
              <div class="d-flex gap-2">
                <VueDatePicker
                  v-model="filters.date_from"
                  auto-apply
                  class="flex-1 border rounded-lg px-2 py-1"
                  format="dd-MM-yyyy"
                  model-type="format"
                  placeholder="From"
                  :teleport="true"
                />
                <VueDatePicker
                  v-model="filters.date_to"
                  auto-apply
                  class="flex-1 border rounded-lg px-2 py-1"
                  format="dd-MM-yyyy"
                  model-type="format"
                  placeholder="To"
                  :teleport="true"
                />
              </div>
            </template>
          </v-col>
        </v-row>

        <div class="d-flex justify-end mt-4">
          <v-btn
            color="primary"
            prepend-icon="mdi-filter"
            @click="applyFilters"
          >
            Apply Filters
          </v-btn>
          <v-btn
            class="ml-2"
            prepend-icon="mdi-close-circle"
            variant="outlined"
            @click="resetFilters"
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
          :items="values"
          :loading="loading"
        >
          <template #loading>
            <v-skeleton-loader type="table-row@10" />
          </template>

          <template #item.quantity="{ item }">
            <div class="d-flex flex-column align-end">
              <v-chip color="blue" variant="flat">
                {{ parseFloat(item.quantity) }} {{ item.unit }}
              </v-chip>
              <div
                v-if="item.human_readable_quantity"
                class="text-caption text-grey mt-1"
              >
                {{ item.human_readable_quantity }}
                {{ item.human_readable_unit }}
              </div>
            </div>
          </template>

          <template #item.price="{ item }">
            <span class="font-weight-medium">{{
              formatCurrency(item.price)
            }}</span>
          </template>

          <template #item.total="{ item }">
            <v-chip color="green" variant="flat">
              {{ formatCurrency(item.total) }}
            </v-chip>
          </template>

          <template #item.date="{ item }">
            {{ item.date }}
          </template>

          <template #item.actions="{ item }">
            <v-btn
              color="blue"
              icon
              size="small"
              variant="text"
              @click="openEditDialog(item)"
            >
              <v-icon>mdi-pencil</v-icon>
            </v-btn>
            <v-btn
              color="red"
              icon
              size="small"
              variant="text"
              @click="deletePurchase(item)"
            >
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>

          <template #no-data>
            <div class="text-center py-6 text-grey">
              <v-icon color="grey-lighten-2" size="48">mdi-cart-remove</v-icon>
              <div>No purchases found</div>
            </div>
          </template>
        </v-data-table>

        <v-divider />
        <div class="d-flex justify-space-between align-center pa-4">
          <span class="text-caption text-grey">
            Showing {{ values.length }} of {{ totalRecords }} records
          </span>
          <v-pagination
            v-model="page"
            color="primary"
            :length="totalPages"
            :total-visible="7"
            @update:model-value="loadValues"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- ADD PURCHASE DIALOG -->
    <v-dialog v-model="addDialog" max-width="700px" persistent>
      <v-card>
        <v-toolbar class="text-white" color="primary" density="comfortable">
          <v-toolbar-title>
            <v-icon start>mdi-cart-plus</v-icon>
            Add New Purchase
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="closeAddDialog"
          />
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-form ref="addFormRef" @submit.prevent="createPurchase">
            <v-autocomplete
              v-model="form.item_id"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="errors.item_id"
              inputmode="none"
              item-title="name"
              item-value="id"
              :items="items"
              label="Item *"
              required
              spellcheck="false"
              variant="outlined"
              @blur="validateField('item_id')"
              @input="onItemChange"
            >
              <template #label>
                <span class="required-field">Item</span>
              </template>
            </v-autocomplete>

            <!-- Quantity Input with Unit Display -->
            <div class="mb-4">
              <v-text-field
                v-model.number="form.quantity"
                autocomplete="off"
                autocorrect="off"
                color="primary"
                :error-messages="errors.quantity"
                inputmode="none"
                :label="`Quantity in ${selectedItemUnit || 'units'} *`"
                required
                spellcheck="false"
                type="number"
                variant="outlined"
                @blur="validateField('quantity')"
                @input="
                  clearError('quantity');
                  calculateTotal();
                  updateHumanReadableQuantity();
                "
              >
                <template #label>
                  <span class="required-field"
                    >Quantity ({{ selectedItemUnit || "units" }})</span
                  >
                </template>
              </v-text-field>

              <!-- Human Readable Quantity Display -->
              <v-card
                v-if="form.quantity && selectedItemHasConversion"
                class="pa-3"
                color="blue-lighten-5"
                variant="outlined"
              >
                <div class="d-flex justify-space-between align-center">
                  <span class="font-weight-medium">Converted Quantity:</span>
                  <span class="text-h6 font-weight-bold text-blue">
                    {{ humanReadableQuantity }} {{ selectedItemHumanUnit }}
                  </span>
                </div>
                <div class="text-caption text-grey mt-1">
                  Conversion: 1 {{ selectedItemUnit }} =
                  {{ selectedItemConversionFactor }} {{ selectedItemHumanUnit }}
                </div>
              </v-card>
            </div>

            <v-text-field
              v-model.number="form.price"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="errors.price"
              inputmode="none"
              label="Unit Price *"
              prefix="TSh "
              required
              spellcheck="false"
              type="number"
              variant="outlined"
              @blur="validateField('price')"
              @input="
                clearError('price');
                calculateTotal();
              "
            >
              <template #label>
                <span class="required-field">Unit Price</span>
              </template>
            </v-text-field>

            <v-card
              v-if="form.quantity && form.price"
              class="mb-4 pa-3"
              color="green-lighten-5"
              variant="outlined"
            >
              <div class="d-flex justify-space-between align-center">
                <span class="font-weight-medium">Total Amount:</span>
                <span class="text-h6 font-weight-bold text-green">
                  {{ formatCurrency(form.quantity * form.price) }}
                </span>
              </div>
            </v-card>

            <div class="d-flex flex-column">
              <label class="text-caption text-grey mb-1 required-field"
                >Purchase Date *</label
              >
              <VueDatePicker
                v-model="form.date"
                auto-apply
                :class="[
                  'rounded-lg',
                  'border',
                  'px-4',
                  'py-2',
                  'w-100',
                  errors.date ? 'error-field' : '',
                ]"
                format="dd-MM-yyyy"
                model-type="format"
                placeholder="Purchase Date"
                :teleport="true"
                @blur="validateField('date')"
                @update:model-value="clearError('date')"
              />
              <div v-if="errors.date" class="text-caption text-error mt-1">
                {{ errors.date }}
              </div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn color="grey" variant="outlined" @click="closeAddDialog"
            >Cancel</v-btn
          >
          <v-btn color="primary" :loading="saving" @click="createPurchase">
            <v-icon start>mdi-content-save</v-icon> Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- EDIT PURCHASE DIALOG -->
    <v-dialog v-model="editDialog" max-width="700px" persistent>
      <v-card>
        <v-toolbar class="text-white" color="primary" density="comfortable">
          <v-toolbar-title>
            <v-icon start>mdi-cart-edit</v-icon>
            Edit Purchase
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="closeEditDialog"
          />
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-form ref="editFormRef" @submit.prevent="updatePurchase">
            <v-autocomplete
              v-model="form.item_id"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="errors.item_id"
              inputmode="none"
              item-title="name"
              item-value="id"
              :items="items"
              label="Item *"
              required
              spellcheck="false"
              variant="outlined"
              @blur="validateField('item_id')"
              @input="onItemChange"
            >
              <template #label>
                <span class="required-field">Item</span>
              </template>
            </v-autocomplete>

            <!-- Quantity Input with Unit Display -->
            <div class="mb-4">
              <v-text-field
                v-model.number="form.quantity"
                autocomplete="off"
                autocorrect="off"
                color="primary"
                :error-messages="errors.quantity"
                inputmode="none"
                :label="`Quantity in ${selectedItemUnit || 'units'} *`"
                required
                spellcheck="false"
                type="number"
                variant="outlined"
                @blur="validateField('quantity')"
                @input="
                  clearError('quantity');
                  calculateTotal();
                  updateHumanReadableQuantity();
                "
              >
                <template #label>
                  <span class="required-field"
                    >Quantity ({{ selectedItemUnit || "units" }})</span
                  >
                </template>
              </v-text-field>

              <!-- Human Readable Quantity Display -->
              <v-card
                v-if="form.quantity && selectedItemHasConversion"
                class="pa-3"
                color="blue-lighten-5"
                variant="outlined"
              >
                <div class="d-flex justify-space-between align-center">
                  <span class="font-weight-medium">Converted Quantity:</span>
                  <span class="text-h6 font-weight-bold text-blue">
                    {{ humanReadableQuantity }} {{ selectedItemHumanUnit }}
                  </span>
                </div>
                <div class="text-caption text-grey mt-1">
                  Conversion: 1 {{ selectedItemUnit }} =
                  {{ selectedItemConversionFactor }} {{ selectedItemHumanUnit }}
                </div>
              </v-card>
            </div>

            <v-text-field
              v-model.number="form.price"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="errors.price"
              inputmode="none"
              label="Unit Price *"
              prefix="TSh "
              required
              spellcheck="false"
              type="number"
              variant="outlined"
              @blur="validateField('price')"
              @input="
                clearError('price');
                calculateTotal();
              "
            >
              <template #label>
                <span class="required-field">Unit Price</span>
              </template>
            </v-text-field>

            <v-card
              v-if="form.quantity && form.price"
              class="mb-4 pa-3"
              color="green-lighten-5"
              variant="outlined"
            >
              <div class="d-flex justify-space-between align-center">
                <span class="font-weight-medium">Total Amount:</span>
                <span class="text-h6 font-weight-bold text-green">
                  {{ formatCurrency(form.quantity * form.price) }}
                </span>
              </div>
            </v-card>

            <div class="d-flex flex-column">
              <label class="text-caption text-grey mb-1 required-field"
                >Purchase Date *</label
              >
              <VueDatePicker
                v-model="form.date"
                auto-apply
                :class="[
                  'rounded-lg',
                  'border',
                  'px-4',
                  'py-2',
                  'w-100',
                  errors.date ? 'error-field' : '',
                ]"
                format="dd-MM-yyyy"
                model-type="format"
                placeholder="Purchase Date"
                :teleport="true"
                @blur="validateField('date')"
                @update:model-value="clearError('date')"
              />
              <div v-if="errors.date" class="text-caption text-error mt-1">
                {{ errors.date }}
              </div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-btn
            color="red"
            variant="outlined"
            @click="deletePurchase(currentItem)"
          >
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
          <v-spacer />
          <v-btn color="grey" variant="outlined" @click="closeEditDialog"
            >Cancel</v-btn
          >
          <v-btn color="primary" :loading="saving" @click="updatePurchase">
            <v-icon start>mdi-content-save</v-icon> Update
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
import { computed, onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";
import moment from "moment";

const store = useStore();

/* STATE */
const values = ref([]);
const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const addDialog = ref(false);
const editDialog = ref(false);
const page = ref(1);
const totalPages = ref(1);
const totalRecords = ref(0);
const currentItem = ref(null);
const addFormRef = ref(null);
const editFormRef = ref(null);

const totals = reactive({
  total_quantity: 0,
  total_amount: 0,
});

const form = reactive({
  item_id: "",
  quantity: "",
  price: "",
  date: "",
});

const errors = reactive({
  item_id: "",
  quantity: "",
  price: "",
  date: "",
});

const snackbar = reactive({
  show: false,
  message: "",
  color: "success",
});

const filters = reactive({
  item_id: "",
  date_operator: "",
  date: "",
  date_from: "",
  date_to: "",
});

/* COMPUTED */
const avgUnitPrice = computed(() => {
  if (!totals.total_amount || !totals.total_quantity) return 0;
  return totals.total_amount / totals.total_quantity;
});

// Selected item properties
const selectedItem = computed(() => {
  return items.value.find((item) => item.id === form.item_id) || {};
});

const selectedItemUnit = computed(() => {
  return selectedItem.value.unit || "";
});

const selectedItemHumanUnit = computed(() => {
  return selectedItem.value.human_readable_unit || "";
});

const selectedItemConversionFactor = computed(() => {
  return selectedItem.value.conversion_factor || 1;
});

const selectedItemHasConversion = computed(() => {
  return (
    selectedItem.value.human_readable_unit &&
    selectedItem.value.conversion_factor
  );
});

const humanReadableQuantity = computed(() => {
  if (!form.quantity || !selectedItemHasConversion.value) return 0;
  return (form.quantity * selectedItemConversionFactor.value).toFixed(6);
});

/* TABLE HEADERS */
const headers = [
  { title: "Item", key: "item_name" },
  {
    title: "Quantity",
    key: "quantity",
    align: "end",
    sortable: false,
  },
  { title: "Unit Price", key: "price", align: "end" },
  { title: "Total Amount", key: "total", align: "end" },
  { title: "Purchase Date", key: "date" },
  { title: "Actions", key: "actions", align: "center", sortable: false },
];

const dateOperators = [
  { label: "Equals (=)", value: "=" },
  { label: "Greater Than (>)", value: ">" },
  { label: "Less Than (<)", value: "<" },
  { label: "Greater or Equal (>=)", value: ">=" },
  { label: "Less or Equal (<=)", value: "<=" },
  { label: "In Range", value: "in" },
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

function showSnackbar(message, color = "success") {
  snackbar.message = message;
  snackbar.color = color;
  snackbar.show = true;
}

function calculateTotal() {
  return form.quantity && form.price ? form.quantity * form.price : 0;
}

function updateHumanReadableQuantity() {
  // This is handled by the computed property
}

function onItemChange() {
  clearError("item_id");
  // Reset human readable quantity display when item changes
}

/* VALIDATIONS */
function validateField(field) {
  switch (field) {
    case "item_id":
      errors.item_id = !form.item_id ? "Item selection is required" : "";
      break;
    case "quantity":
      if (!form.quantity && form.quantity !== 0) {
        errors.quantity = "Quantity is required";
      } else if (isNaN(form.quantity)) {
        errors.quantity = "Quantity must be a valid number";
      } else if (form.quantity <= 0) {
        errors.quantity = "Quantity must be positive";
      } else {
        errors.quantity = "";
      }
      break;
    case "price":
      if (!form.price && form.price !== 0) {
        errors.price = "Unit price is required";
      } else if (isNaN(form.price)) {
        errors.price = "Unit price must be a valid number";
      } else if (form.price <= 0) {
        errors.price = "Unit price must be positive";
      } else {
        errors.price = "";
      }
      break;
    case "date":
      errors.date = !form.date ? "Purchase date is required" : "";
      break;
  }
}

function clearError(field) {
  errors[field] = "";
}

function validateForm() {
  validateField("item_id");
  validateField("quantity");
  validateField("price");
  validateField("date");

  return !errors.item_id && !errors.quantity && !errors.price && !errors.date;
}

/* LOADERS */
async function loadItems() {
  try {
    const res = await fetch("/items");
    const data = await res.json();
    // Ensure we have the conversion data
    items.value = data.map((item) => ({
      ...item,
      human_readable_unit: item.human_readable_unit || "",
      conversion_factor: item.conversion_factor || 1,
    }));
  } catch (err) {
    console.error("Failed to load items:", err);
    showSnackbar("Failed to load items", "error");
  }
}

async function loadValues() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: page.value,
      limit: 10,
    });

    if (filters.item_id) params.append("item_id", filters.item_id);
    if (
      filters.date_operator &&
      filters.date_operator !== "in" &&
      filters.date
    ) {
      const map = {
        "=": "date",
        ">": "date_gt",
        "<": "date_lt",
        ">=": "date_from",
        "<=": "date_to",
      };
      params.append(map[filters.date_operator], filters.date);
    }
    if (
      filters.date_operator === "in" &&
      filters.date_from &&
      filters.date_to
    ) {
      params.append("date_from", filters.date_from);
      params.append("date_to", filters.date_to);
    }

    const res = await fetch(`/purchases?${params}`);
    const data = await res.json();

    // Process data to include human readable quantities
    values.value = (data.data || []).map((purchase) => {
      const item = items.value.find((i) => i.id === purchase.item_id) || {};
      const hasConversion = item.human_readable_unit && item.conversion_factor;

      return {
        ...purchase,
        human_readable_quantity: hasConversion
          ? (purchase.quantity * item.conversion_factor).toFixed(6)
          : null,
        human_readable_unit: item.human_readable_unit,
        unit: item.unit || "",
      };
    });

    totalPages.value = data.totalPages || 1;
    totalRecords.value = data.totalRecords || 0;
    totals.total_quantity = data.total_quantity || 0;
    totals.total_amount = data.total_amount || 0;
  } catch (err) {
    console.error("Failed to load purchases:", err);
    showSnackbar("Failed to load purchases", "error");
  } finally {
    loading.value = false;
  }
}

/* FILTERS */
function applyFilters() {
  page.value = 1;
  loadValues();
}

function resetFilters() {
  Object.assign(filters, {
    item_id: "",
    date_operator: "",
    date: "",
    date_from: "",
    date_to: "",
  });
  page.value = 1;
  loadValues();
}

/* CRUD OPERATIONS */
function openAddDialog() {
  Object.assign(form, {
    item_id: "",
    quantity: "",
    price: "",
    date: "",
  });
  Object.keys(errors).forEach((key) => (errors[key] = ""));
  addDialog.value = true;
}

function closeAddDialog() {
  addDialog.value = false;
  Object.keys(errors).forEach((key) => (errors[key] = ""));
}

function openEditDialog(item) {
  currentItem.value = item;
  Object.assign(form, {
    item_id: item.item_id,
    quantity: item.quantity?.replace?.(/,/g, "") || item.quantity,
    price: item.price?.replace?.(/,/g, "") || item.price,
    date: item.date ? item.date : "",
  });
  Object.keys(errors).forEach((key) => (errors[key] = ""));
  editDialog.value = true;
}

function closeEditDialog() {
  editDialog.value = false;
  Object.keys(errors).forEach((key) => (errors[key] = ""));
}

async function createPurchase() {
  if (!validateForm()) {
    showSnackbar("Please fix the validation errors", "error");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...form,
      date: moment(form.date, "DD-MM-YYYY").format("YYYY-MM-DD"),
    };

    const res = await fetch("/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Save failed");

    addDialog.value = false;
    showSnackbar("Purchase added successfully");
    await loadValues();
  } catch (err) {
    console.error("Failed to create purchase:", err);
    showSnackbar("Failed to add purchase", "error");
  } finally {
    saving.value = false;
  }
}

async function updatePurchase() {
  if (!validateForm()) {
    showSnackbar("Please fix the validation errors", "error");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      ...form,
      date: moment(form.date, "DD-MM-YYYY").format("YYYY-MM-DD"),
    };

    const res = await fetch(`/purchases/${currentItem.value.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Update failed");

    editDialog.value = false;
    showSnackbar("Purchase updated successfully");
    await loadValues();
  } catch (err) {
    console.error("Failed to update purchase:", err);
    showSnackbar("Failed to update purchase", "error");
  } finally {
    saving.value = false;
  }
}

async function deletePurchase(item) {
  if (
    !confirm(`Are you sure you want to delete purchase of "${item.item_name}"?`)
  )
    return;

  saving.value = true;
  try {
    const res = await fetch(`/purchases/${item.id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");

    showSnackbar("Purchase deleted successfully");
    if (editDialog.value) editDialog.value = false;
    await loadValues();
  } catch (err) {
    console.error("Failed to delete purchase:", err);
    showSnackbar("Failed to delete purchase", "error");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadItems();
  await loadValues();
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
.flex-1 {
  flex: 1;
}
</style>
