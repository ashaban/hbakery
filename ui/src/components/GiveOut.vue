<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-gift-outline</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Product Giveaways
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Manage charity donations and product rejects with stock
                  tracking
                </p>
              </div>
            </div>
          </v-col>
          <v-col
            v-if="$store.getters.hasTask('can_release_products_for_free')"
            class="text-right"
            cols="12"
            md="6"
          >
            <v-btn color="primary" size="large" @click="openAddDialog">
              <v-icon start>mdi-plus</v-icon>
              New Giveaway
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
            <v-select
              v-model="filters.outlet_id"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="outlets"
              label="Outlets"
              multiple
              prepend-inner-icon="mdi-store"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-select
              v-model="filters.status"
              clearable
              density="comfortable"
              :items="[
                { title: 'All', value: '' },
                { title: 'Posted', value: 'POSTED' },
                { title: 'Cancelled', value: 'CANCELLED' },
              ]"
              label="Status"
              prepend-inner-icon="mdi-filter"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-text-field
              v-model="filters.reason"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="Reason"
              prepend-inner-icon="mdi-tag"
              spellcheck="false"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-text-field
              v-model="filters.start_date"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="Start Date"
              prepend-inner-icon="mdi-calendar"
              spellcheck="false"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="2">
            <v-text-field
              v-model="filters.end_date"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="End Date"
              prepend-inner-icon="mdi-calendar"
              spellcheck="false"
              type="date"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex justify-end" cols="12" sm="12">
            <v-btn
              class="mr-2"
              color="primary"
              variant="flat"
              @click="loadGiveaways"
            >
              <v-icon start>mdi-magnify</v-icon>
              Search
            </v-btn>
            <v-btn color="grey" variant="outlined" @click="resetFilters">
              <v-icon start>mdi-refresh</v-icon>
              Reset
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- LIST -->
    <v-card class="rounded-lg" elevation="2">
      <v-progress-linear
        :active="loading"
        color="primary"
        height="4"
        :indeterminate="loading"
      />
      <v-data-table
        class="elevation-0"
        :headers="headers"
        :items="giveaways"
        :items-per-page="10"
        :loading="loading"
        loading-text="Loading giveaways..."
        no-data-text="No giveaways found"
      >
        <template #top>
          <v-card-title class="d-flex align-center pt-4">
            <v-icon class="mr-2" color="primary"
              >mdi-format-list-bulleted</v-icon
            >
            Recent Giveaways
            <v-chip class="ml-3" color="primary" size="small" variant="flat">
              {{ giveaways.length }} total
            </v-chip>
          </v-card-title>
          <v-divider />
        </template>

        <template #item.out_date="{ item }">
          <div class="d-flex align-center">
            <v-icon class="mr-2" color="grey" size="16">mdi-calendar</v-icon>
            <span class="font-weight-medium">{{
              formatDate(item.out_date)
            }}</span>
          </div>
        </template>

        <template #item.outlet_name="{ item }">
          <div class="d-flex align-center">
            <v-avatar
              class="mr-2"
              :color="getOutletColor(item.outlet_type)"
              size="28"
            >
              <v-icon color="white" size="14">{{
                getOutletIcon(item.outlet_type)
              }}</v-icon>
            </v-avatar>
            <div class="font-weight-medium">{{ item.outlet_name }}</div>
          </div>
        </template>

        <template #item.reason="{ item }">
          <v-chip
            :color="getReasonColor(item.reason)"
            size="small"
            variant="flat"
          >
            {{ item.reason }}
          </v-chip>
        </template>

        <template #item.total_qty="{ item }">
          <v-chip color="green" size="small" variant="flat">
            {{ item.total_qty }}
          </v-chip>
        </template>

        <template #item.total_cost_value="{ item }">
          <div class="text-right font-weight-bold text-orange">
            {{ money(item.total_cost_value) }}
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="getStatusColor(item.status)"
            size="small"
            variant="flat"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  color="info"
                  icon
                  size="small"
                  variant="text"
                  @click="openViewDialog(item)"
                >
                  <v-icon>mdi-eye-outline</v-icon>
                </v-btn>
              </template>
              <span>View</span>
            </v-tooltip>

            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
                  v-if="$store.getters.hasTask('can_edit_free_release')"
                  v-bind="props"
                  color="primary"
                  :disabled="item.status === 'CANCELLED'"
                  icon
                  size="small"
                  variant="text"
                  @click="openEditDialog(item)"
                >
                  <v-icon>mdi-pencil-outline</v-icon>
                </v-btn>
              </template>
              <span>Edit</span>
            </v-tooltip>

            <v-tooltip location="top">
              <template #activator="{ props }">
                <v-btn
                  v-if="$store.getters.hasTask('can_delete_free_release')"
                  v-bind="props"
                  color="error"
                  :disabled="item.status === 'CANCELLED'"
                  icon
                  size="small"
                  variant="text"
                  @click="openDeleteDialog(item)"
                >
                  <v-icon>mdi-delete-outline</v-icon>
                </v-btn>
              </template>
              <span>Cancel</span>
            </v-tooltip>
          </div>
        </template>
      </v-data-table>

      <v-card-actions class="px-4 py-3 bg-grey-lighten-3">
        <v-spacer />
        <v-pagination
          v-model="page"
          color="primary"
          :length="totalPages"
          total-visible="7"
          @update:model-value="loadGiveaways"
        />
      </v-card-actions>
    </v-card>

    <!-- CREATE/EDIT DIALOG -->
    <v-dialog v-model="showDialog" max-width="1200" persistent scrollable>
      <v-card class="rounded-lg">
        <v-toolbar
          :color="isEditing ? 'warning' : 'primary'"
          density="comfortable"
        >
          <v-avatar
            class="mr-3"
            :color="isEditing ? 'warning' : 'primary'"
            size="40"
          >
            <v-icon color="white">{{
              isEditing ? "mdi-pencil" : "mdi-plus"
            }}</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ isEditing ? "Edit Giveaway" : "Create New Giveaway" }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="closeDialog"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <!-- Header -->
          <v-card class="mb-6" variant="outlined">
            <v-card-title class="d-flex align-center bg-blue-lighten-5">
              <v-icon class="mr-2" color="primary">mdi-information</v-icon>
              Giveaway Information
            </v-card-title>
            <v-card-text class="pa-4">
              <v-row>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.outlet_id"
                    item-title="name"
                    item-value="id"
                    :items="outlets"
                    label="Outlet *"
                    prepend-inner-icon="mdi-store"
                    required
                    variant="outlined"
                    @update:model-value="onOutletChange"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model="form.out_date"
                    autocomplete="off"
                    autocorrect="off"
                    inputmode="none"
                    label="Date *"
                    prepend-inner-icon="mdi-calendar"
                    required
                    spellcheck="false"
                    type="date"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="form.reason"
                    :items="reasonOptions"
                    label="Reason *"
                    prepend-inner-icon="mdi-tag"
                    required
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12">
                  <v-textarea
                    v-model="form.notes"
                    label="Notes"
                    placeholder="Add any notes about this giveaway..."
                    rows="2"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Items -->
          <v-card class="mb-6" variant="outlined">
            <v-card-title
              class="d-flex align-center justify-space-between bg-green-lighten-5"
            >
              <div class="d-flex align-center">
                <v-icon class="mr-2" color="green">mdi-package-variant</v-icon>
                Give Away Items
                <v-chip class="ml-3" color="green" size="small" variant="flat">
                  {{ form.items.length }} items
                </v-chip>
                <v-chip
                  class="ml-2"
                  color="orange"
                  size="small"
                  variant="tonal"
                >
                  Total Cost: {{ money(totalCostValue) }}
                </v-chip>
              </div>
              <v-btn
                color="green"
                :disabled="!form.outlet_id"
                size="small"
                @click="addItem"
              >
                <v-icon start>mdi-plus</v-icon>
                Add Item
              </v-btn>
            </v-card-title>

            <v-card-text class="pa-4">
              <v-alert
                v-if="validationErrors.length"
                class="mb-4"
                color="error"
                icon="mdi-alert-circle"
                variant="tonal"
              >
                <div v-for="err in validationErrors" :key="err">
                  • {{ err }}
                </div>
              </v-alert>

              <div v-for="(it, idx) in form.items" :key="idx" class="mb-4">
                <v-card class="elevation-1">
                  <v-card-text class="pa-4">
                    <v-row align="center" dense>
                      <v-col cols="12" md="3">
                        <v-autocomplete
                          v-model="it.product_id"
                          autocomplete="off"
                          autocorrect="off"
                          inputmode="none"
                          item-title="name"
                          item-value="id"
                          :items="products"
                          label="Product *"
                          prepend-inner-icon="mdi-cube-outline"
                          required
                          spellcheck="false"
                          variant="outlined"
                          @update:model-value="() => onProductChange(it)"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-select
                          v-model="it.quality"
                          :color="getQualityColor(it.quality)"
                          item-title="title"
                          item-value="value"
                          :items="qualityOptions"
                          label="Quality *"
                          required
                          variant="outlined"
                          @update:model-value="() => onQualityChange(it)"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-text-field
                          v-model="it.quantity"
                          autocomplete="off"
                          autocorrect="off"
                          density="comfortable"
                          :error="hasItemStockError(it)"
                          :hint="itemQuantityHint(it)"
                          inputmode="none"
                          label="Quantity *"
                          persistent-hint
                          spellcheck="false"
                          type="number"
                          variant="outlined"
                          @input="validateForm"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-text-field
                          v-model="it.remarks"
                          autocomplete="off"
                          autocorrect="off"
                          density="comfortable"
                          inputmode="none"
                          label="Remarks"
                          placeholder="Optional remarks..."
                          spellcheck="false"
                          variant="outlined"
                        />
                      </v-col>

                      <v-col cols="12" md="2">
                        <v-card
                          class="pa-3 text-center"
                          color="blue-lighten-5"
                          variant="flat"
                        >
                          <div
                            class="text-caption text-blue-darken-3 font-weight-bold"
                          >
                            AVAILABLE
                          </div>
                          <div
                            class="text-h6 font-weight-bold text-blue-darken-3"
                          >
                            {{ getItemAvailable(it) }}
                          </div>
                        </v-card>
                      </v-col>

                      <v-col class="text-right" cols="12" md="1">
                        <v-btn
                          color="error"
                          icon
                          size="small"
                          variant="text"
                          @click="removeItem(idx)"
                        >
                          <v-icon>mdi-delete-outline</v-icon>
                        </v-btn>
                      </v-col>
                    </v-row>
                  </v-card-text>
                </v-card>
              </div>

              <div v-if="form.items.length === 0" class="text-center py-8">
                <v-icon class="mb-4" color="grey" size="64"
                  >mdi-package-variant-plus</v-icon
                >
                <div class="text-h6 text-grey mb-2">No Items Added</div>
                <div class="text-body-1 text-grey mb-4">
                  Click "Add Item" to start adding products to this giveaway
                </div>
                <v-btn
                  color="primary"
                  :disabled="!form.outlet_id"
                  @click="addItem"
                >
                  <v-icon start>mdi-plus</v-icon>
                  Add Your First Item
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="closeDialog"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            :disabled="!canSave"
            :loading="saving"
            size="large"
            variant="flat"
            @click="saveGiveaway"
          >
            <v-icon start>{{
              isEditing ? "mdi-content-save" : "mdi-check"
            }}</v-icon>
            {{ isEditing ? "Update Giveaway" : "Create Giveaway" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- VIEW DIALOG -->
    <v-dialog
      v-model="showViewDialog"
      max-width="800"
      scrollable
      transition="dialog-bottom-transition"
    >
      <v-card class="rounded-lg">
        <v-toolbar color="info" density="comfortable">
          <v-avatar class="mr-3" color="info" size="40">
            <v-icon color="white">mdi-eye</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold"
            >Giveaway Details</v-toolbar-title
          >
          <v-spacer />
          <v-btn icon @click="showViewDialog = false"
            ><v-icon>mdi-close</v-icon></v-btn
          >
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-card class="mb-6 elevation-2">
            <v-card-text class="pa-4">
              <v-row>
                <v-col class="border-e" cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar class="mr-3" color="primary" size="48">
                      <v-icon color="white">mdi-identifier</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">GIVEAWAY ID</div>
                      <div class="text-h5 font-weight-bold">
                        #{{ currentGiveaway?.out?.id }}
                      </div>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-icon class="mr-3" color="grey">mdi-calendar</v-icon>
                    <div>
                      <div class="text-caption text-grey">DATE</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ formatDate(currentGiveaway?.out?.out_date) }}
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-avatar
                      class="mr-3"
                      :color="getOutletColor(currentGiveaway?.out?.outlet_type)"
                      size="48"
                    >
                      <v-icon color="white">{{
                        getOutletIcon(currentGiveaway?.out?.outlet_type)
                      }}</v-icon>
                    </v-avatar>
                    <div>
                      <div class="text-caption text-grey">OUTLET</div>
                      <div class="text-body-1 font-weight-medium">
                        {{ currentGiveaway?.out?.outlet_name }}
                      </div>
                      <v-chip
                        class="mt-1"
                        :color="
                          getOutletColor(currentGiveaway?.out?.outlet_type)
                        "
                        size="small"
                      >
                        {{ currentGiveaway?.out?.outlet_type }}
                      </v-chip>
                    </div>
                  </div>
                  <div class="d-flex align-center">
                    <v-icon class="mr-3" color="grey">mdi-tag</v-icon>
                    <div>
                      <div class="text-caption text-grey">REASON</div>
                      <div class="text-body-1 font-weight-medium">
                        <v-chip
                          :color="getReasonColor(currentGiveaway?.out?.reason)"
                          size="small"
                        >
                          {{ currentGiveaway?.out?.reason }}
                        </v-chip>
                      </div>
                    </div>
                  </div>
                </v-col>
                <v-col v-if="currentGiveaway?.out?.notes" cols="12">
                  <v-divider class="my-3" />
                  <div class="text-caption text-grey mb-1">NOTES</div>
                  <v-card variant="outlined">
                    <v-card-text class="pa-3">{{
                      currentGiveaway?.out?.notes
                    }}</v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <v-card class="mb-6 elevation-2">
            <v-card-title class="d-flex align-center bg-teal-lighten-5">
              <v-icon class="mr-2" color="teal">mdi-package-variant</v-icon>
              Items
            </v-card-title>
            <v-card-text class="pa-0">
              <v-table density="comfortable">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="text-left font-weight-bold text-grey">
                      PRODUCT
                    </th>
                    <th class="text-center font-weight-bold text-grey">
                      QUALITY
                    </th>
                    <th class="text-center font-weight-bold text-grey">QTY</th>
                    <th class="text-center font-weight-bold text-grey">
                      REMARKS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="li in currentGiveaway?.items || []" :key="li.id">
                    <td class="text-left">{{ li.product_name }}</td>
                    <td class="text-center">
                      <v-chip
                        :color="getQualityColor(li.quality)"
                        size="small"
                        variant="flat"
                      >
                        {{ li.quality }}
                      </v-chip>
                    </td>
                    <td class="text-center">{{ parseFloat(li.quantity) }}</td>
                    <td class="text-center">{{ li.remarks || "-" }}</td>
                  </tr>
                </tbody>
              </v-table>
              <div class="text-right pa-4">
                <div class="text-h6 text-orange">
                  Total Cost Value:
                  <strong>{{
                    money(currentGiveaway?.out?.total_cost_value || 0)
                  }}</strong>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            color="primary"
            size="large"
            variant="flat"
            @click="showViewDialog = false"
          >
            <v-icon start>mdi-close</v-icon>
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DELETE DIALOG -->
    <v-dialog v-model="showDeleteDialog" max-width="500">
      <v-card class="rounded-lg">
        <v-toolbar color="error" density="comfortable">
          <v-avatar class="mr-3" color="error" size="40">
            <v-icon color="white">mdi-alert</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold"
            >Confirm Cancellation</v-toolbar-title
          >
        </v-toolbar>
        <v-card-text class="pa-6 text-center">
          <v-icon class="mb-4" color="error" size="64">mdi-cancel</v-icon>
          <div class="text-h5 font-weight-bold mb-2">Cancel Giveaway?</div>
          <div class="text-body-1 text-grey mb-4">
            Are you sure you want to cancel giveaway
            <span class="font-weight-bold text-error"
              >#{{ currentGiveawayId }}</span
            >? This will reverse the stock adjustments.
          </div>
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            size="large"
            variant="outlined"
            @click="showDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn
            color="error"
            :loading="deleting"
            size="large"
            variant="flat"
            @click="confirmDelete"
          >
            <v-icon start>mdi-cancel</v-icon>
            Cancel Giveaway
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useStore } from "vuex";

const store = useStore();

// State
const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const giveaways = ref([]);
const outlets = ref([]);
const products = ref([]);
const page = ref(1);
const totalPages = ref(1);

// UI state
const showDialog = ref(false);
const showViewDialog = ref(false);
const showDeleteDialog = ref(false);
const isEditing = ref(false);
const currentGiveawayId = ref(null);
const currentGiveaway = ref(null);

// Filters
const filters = reactive({
  outlet_id: [],
  status: "",
  reason: "",
  start_date: "",
  end_date: "",
});

// Form
const today = new Date().toISOString().split("T")[0];
const form = reactive({
  outlet_id: "",
  out_date: today,
  reason: "CHARITY",
  notes: "",
  items: [],
});

// Validation
const validationErrors = ref([]);

// Constants
const headers = [
  { title: "ID", key: "id" },
  { title: "Date", key: "out_date" },
  { title: "Outlet", key: "outlet_name" },
  { title: "Reason", key: "reason" },
  { title: "Items", key: "items_count", align: "center" },
  { title: "Qty", key: "total_qty", align: "center" },
  { title: "Cost Value", key: "total_cost_value", align: "end" },
  { title: "Status", key: "status", align: "center" },
  { title: "Actions", key: "actions", sortable: false },
];

const qualityOptions = [
  { title: "GOOD", value: "GOOD" },
  { title: "DAMAGED", value: "DAMAGED" },
  { title: "REJECT", value: "REJECT" },
];

const reasonOptions = [
  "CHARITY",
  "REJECT",
  "SAMPLE",
  "DAMAGED",
  "EXPIRED",
  "OTHER",
];

// Computed
const totalCostValue = computed(() => {
  // This would be calculated from the ledger, but we show it as read-only
  return 0; // Actual calculation would come from API
});

const canSave = computed(() => {
  return (
    form.outlet_id &&
    form.out_date &&
    form.reason &&
    form.items.length > 0 &&
    validationErrors.value.length === 0
  );
});

// Helpers
function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

function getOutletIcon(type) {
  const icons = { MAIN: "mdi-home", SHOP: "mdi-store", CAR: "mdi-truck" };
  return icons[type] || "mdi-store";
}

function getOutletColor(type) {
  const colors = { MAIN: "primary", SHOP: "success", CAR: "warning" };
  return colors[type] || "grey";
}

function getQualityColor(q) {
  const colors = { GOOD: "success", DAMAGED: "warning", EXPIRED: "error" };
  return colors[q] || "grey";
}

function getStatusColor(status) {
  const colors = { POSTED: "success", CANCELLED: "error" };
  return colors[status] || "grey";
}

function getReasonColor(reason) {
  const colors = {
    CHARITY: "purple",
    REJECT: "red",
    SAMPLE: "blue",
    DAMAGED: "orange",
    EXPIRED: "brown",
    OTHER: "grey",
  };
  return colors[reason] || "grey";
}

// Items logic
function addItem() {
  form.items.push({
    product_id: "",
    quality: "GOOD",
    quantity: "",
    remarks: "",
    stockData: null,
  });
  validateForm();
}

function removeItem(i) {
  form.items.splice(i, 1);
  validateForm();
}

function getItemAvailable(it) {
  if (!it.stockData) return 0;
  return it.stockData[it.quality] || 0;
}

async function onProductChange(it) {
  await fetchItemAvailability(it);
  validateForm();
}

async function onQualityChange(it) {
  await fetchItemAvailability(it);
  validateForm();
}

async function fetchItemAvailability(it) {
  if (!form.outlet_id || !it.product_id) {
    it.stockData = null;
    return;
  }
  try {
    const res = await fetch(
      `/stocktransfers/availableByQuality?outlet_id=${form.outlet_id}&product_id=${it.product_id}`,
    );
    const data = await res.json();
    it.stockData = data.stock || { GOOD: 0, DAMAGED: 0, EXPIRED: 0 };
  } catch (err) {
    console.error("Stock check failed:", err);
    it.stockData = null;
  }
}

function hasItemStockError(it) {
  if (!it.product_id || !it.quality || !it.quantity) return false;
  return Number(it.quantity) > Number(getItemAvailable(it) || 0);
}

function itemQuantityHint(it) {
  if (!it.product_id) return "Pick a product";
  const a = getItemAvailable(it);
  return `Available: ${a}`;
}

// Validation rules
function validateForm() {
  const errs = [];

  if (!form.outlet_id) errs.push("Outlet is required.");
  if (!form.out_date) errs.push("Date is required.");
  if (!form.reason) errs.push("Reason is required.");

  const comboSet = new Set();
  form.items.forEach((it, idx) => {
    const line = idx + 1;
    if (!it.product_id) errs.push(`Item ${line}: product is required.`);
    if (!it.quality) errs.push(`Item ${line}: quality is required.`);
    if (it.quantity === "" || Number(it.quantity) <= 0) {
      errs.push(`Item ${line}: quantity is required and must be > 0.`);
    }
    if (hasItemStockError(it)) {
      errs.push(`Item ${line}: insufficient ${it.quality} stock.`);
    }
    if (it.product_id && it.quality) {
      const key = `${it.product_id}|${it.quality}`;
      if (comboSet.has(key)) {
        errs.push(`Duplicate product and quality detected on item ${idx + 1}.`);
      }
      comboSet.add(key);
    }
  });

  validationErrors.value = errs;
}

// API
async function loadGiveaways() {
  loading.value = true;
  const params = new URLSearchParams({ page: page.value, limit: 10 });
  if (filters.outlet_id?.length) {
    filters.outlet_id.forEach((id) => params.append("outlet_id[]", id));
  } else if (store.state.auth.outlets.length) {
    store.state.auth.outlets.forEach((outlet) =>
      params.append("outlet_id[]", outlet.outlet_id),
    );
  }
  if (filters.status) params.append("status", filters.status);
  if (filters.reason) params.append("reason", filters.reason);
  if (filters.start_date) params.append("start_date", filters.start_date);
  if (filters.end_date) params.append("end_date", filters.end_date);

  try {
    const res = await fetch(`/productOut?${params}`);
    const data = await res.json();
    giveaways.value = data.data || [];
    totalPages.value = data.totalPages || 1;
  } catch (e) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load giveaways",
    });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  filters.outlet_id = "";
  filters.status = "";
  filters.reason = "";
  filters.start_date = "";
  filters.end_date = "";
  loadGiveaways();
}

function openAddDialog() {
  isEditing.value = false;
  currentGiveawayId.value = null;
  resetForm();
  showDialog.value = true;
}

async function openEditDialog(row) {
  isEditing.value = true;
  currentGiveawayId.value = row.id;
  loading.value = true;
  try {
    const res = await fetch(`/productOut/${row.id}`);
    const data = await res.json();

    // Header
    form.outlet_id = data.out.outlet_id;
    form.out_date = data.out.out_date?.split("T")[0] || today;
    form.reason = data.out.reason;
    form.notes = data.out.notes || "";

    // Items
    form.items = (data.items || []).map((li) => ({
      product_id: li.product_id,
      quality: li.quality,
      quantity: String(li.quantity),
      remarks: li.remarks || "",
      stockData: null,
    }));

    // Stock preload
    for (const it of form.items) await fetchItemAvailability(it);

    validateForm();

    showDialog.value = true;
  } catch (e) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load giveaway",
    });
  } finally {
    loading.value = false;
  }
}

async function openViewDialog(row) {
  currentGiveawayId.value = row.id;
  loading.value = true;
  try {
    const res = await fetch(`/productOut/${row.id}`);
    const data = await res.json();

    currentGiveaway.value = data;
    showViewDialog.value = true;
  } catch (e) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load giveaway details",
    });
  } finally {
    loading.value = false;
  }
}

function closeDialog() {
  showDialog.value = false;
  resetForm();
}

function resetForm() {
  form.outlet_id = "";
  form.out_date = today;
  form.reason = "CHARITY";
  form.notes = "";
  form.items = [];
  validationErrors.value = [];
}

function openDeleteDialog(row) {
  currentGiveawayId.value = row.id;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  deleting.value = true;
  try {
    const res = await fetch(`/productOut/${currentGiveawayId.value}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to cancel");
    store.commit("setMessage", {
      type: "success",
      text: "Giveaway cancelled successfully",
    });
    showDeleteDialog.value = false;
    loadGiveaways();
  } catch (e) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to cancel giveaway",
    });
  } finally {
    deleting.value = false;
  }
}

async function onOutletChange() {
  for (const it of form.items) await fetchItemAvailability(it);
  validateForm();
}

// SAVE
async function saveGiveaway() {
  validateForm();
  if (!canSave.value) return;

  saving.value = true;

  const payload = {
    outlet_id: form.outlet_id,
    out_date: form.out_date,
    reason: form.reason,
    notes: form.notes || null,
    items: form.items.map((it) => ({
      product_id: it.product_id,
      quality: it.quality,
      quantity: Number(it.quantity),
      remarks: it.remarks || null,
    })),
  };

  const url = isEditing.value
    ? `/productOut/${currentGiveawayId.value}`
    : "/productOut";
  const method = isEditing.value ? "PUT" : "POST";

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to save giveaway");
    const result = await res.json();

    store.commit("setMessage", {
      type: "success",
      text: isEditing.value
        ? "Giveaway updated successfully"
        : "Giveaway created successfully",
    });

    closeDialog();
    loadGiveaways();
  } catch (e) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to save giveaway",
    });
  } finally {
    saving.value = false;
  }
}

// Init
async function loadInitialData() {
  try {
    const outletsParams = new URLSearchParams({ limit: 1000 });
    if (store.state.auth.outlets.length) {
      store.state.auth.outlets.forEach((outlet) =>
        outletsParams.append("id[]", outlet.outlet_id),
      );
    } else {
      outletsParams.append("id[]", -1); // force no outlets
    }
    const [outRes, prodRes] = await Promise.all([
      fetch(`/outlets?${outletsParams}`),
      fetch("/products?limit=1000"),
    ]);

    outlets.value = (await outRes.json()).data || [];

    products.value = (await prodRes.json()).data || [];
  } catch (e) {
    console.error("Init data load failed:", e);
  }
}

onMounted(() => {
  loadGiveaways();
  loadInitialData();
});
</script>

<style scoped>
.border-e {
  border-right: 1px solid #e0e0e0;
}
.v-card {
  transition: all 0.3s ease;
}
.v-btn {
  transition: all 0.2s ease;
}
.v-dialog .v-card {
  scrollbar-width: thin;
  scrollbar-color: #bdbdbd transparent;
}
.v-dialog .v-card::-webkit-scrollbar {
  width: 6px;
}
.v-dialog .v-card::-webkit-scrollbar-track {
  background: transparent;
}
.v-dialog .v-card::-webkit-scrollbar-thumb {
  background-color: #bdbdbd;
  border-radius: 3px;
}
.text-right {
  text-align: right;
}
</style>
