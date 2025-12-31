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
        <div class="d-flex gap-2">
          <v-btn
            v-if="$store.getters.hasTask('can_add_expenditure')"
            color="primary"
            prepend-icon="mdi-plus"
            @click="openSingleDialog(false)"
          >
            Add Expenditure
          </v-btn>
          <v-btn
            v-if="$store.getters.hasTask('can_add_expenditure')"
            color="secondary"
            prepend-icon="mdi-plus-multiple"
            @click="openBulkDialog"
          >
            Add Multiple
          </v-btn>
        </div>
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
        <v-data-table-server
          v-model:items-per-page="itemsPerPage"
          v-model:page="page"
          class="rounded-lg"
          density="comfortable"
          :headers="headers"
          :items="expenditures"
          :items-length="totalRecords"
          :items-per-page-options="[5, 10, 20, 50, 100]"
          :loading="loading"
          @update:options="loadData"
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
                    v-if="$store.getters.hasTask('can_edit_expenditure')"
                    v-bind="props"
                    color="blue"
                    icon
                    size="small"
                    variant="text"
                    @click="openSingleDialog(true, item)"
                  >
                    <v-icon>mdi-pencil</v-icon>
                  </v-btn>
                </template>
                <span>Edit</span>
              </v-tooltip>
              <v-tooltip location="top">
                <template #activator="{ props }">
                  <v-btn
                    v-if="$store.getters.hasTask('can_delete_expenditure')"
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
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <!-- SINGLE ADD/EDIT DIALOG -->
    <v-dialog v-model="singleDialog" max-width="600px" persistent>
      <v-card>
        <v-toolbar class="text-white" color="primary" density="comfortable">
          <v-toolbar-title>
            {{ editMode ? "Edit Expenditure" : "Add Expenditure" }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="closeSingleDialog"
          />
        </v-toolbar>

        <v-card-text class="pa-4">
          <v-form ref="singleFormRef" @submit.prevent="saveSingleExpenditure">
            <v-autocomplete
              v-model="singleForm.type_id"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="singleErrors.type_id"
              inputmode="none"
              item-title="name"
              item-value="id"
              :items="costTypes"
              label="Cost Type *"
              required
              spellcheck="false"
              variant="outlined"
              @blur="validateSingleField('type_id')"
              @input="clearSingleError('type_id')"
            />

            <v-row dense>
              <v-col cols="12" md="6">
                <div class="d-flex flex-column">
                  <label class="text-caption text-grey mb-1 required-field"
                    >Start Date *</label
                  >
                  <VueDatePicker
                    v-model="singleForm.start_date"
                    auto-apply
                    :class="[
                      'rounded-lg',
                      'border',
                      'px-2',
                      'py-1',
                      'w-100',
                      singleErrors.start_date ? 'error-field' : '',
                    ]"
                    format="dd-MM-yyyy"
                    model-type="format"
                    placeholder="Start Date"
                    :teleport="true"
                    @blur="validateSingleField('start_date')"
                    @update:model-value="clearSingleError('start_date')"
                  />
                  <div
                    v-if="singleErrors.start_date"
                    class="text-caption text-error mt-1"
                  >
                    {{ singleErrors.start_date }}
                  </div>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="d-flex flex-column">
                  <label class="text-caption text-grey mb-1 required-field"
                    >End Date *</label
                  >
                  <VueDatePicker
                    v-model="singleForm.end_date"
                    auto-apply
                    :class="[
                      'rounded-lg',
                      'border',
                      'px-2',
                      'py-1',
                      'w-100',
                      singleErrors.end_date ? 'error-field' : '',
                    ]"
                    format="dd-MM-yyyy"
                    model-type="format"
                    placeholder="End Date"
                    :teleport="true"
                    @blur="validateSingleField('end_date')"
                    @update:model-value="validateSingleDateRange()"
                  />
                  <div
                    v-if="singleErrors.end_date"
                    class="text-caption text-error mt-1"
                  >
                    {{ singleErrors.end_date }}
                  </div>
                </div>
              </v-col>
            </v-row>

            <v-text-field
              v-model.number="singleForm.amount"
              autocomplete="off"
              autocorrect="off"
              color="primary"
              :error-messages="singleErrors.amount"
              inputmode="none"
              label="Amount *"
              prefix="$"
              required
              spellcheck="false"
              type="number"
              variant="outlined"
              @blur="validateSingleField('amount')"
              @input="clearSingleError('amount')"
            />

            <v-textarea
              v-model="singleForm.description"
              color="primary"
              label="Description"
              rows="3"
              variant="outlined"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn color="grey" variant="outlined" @click="closeSingleDialog"
            >Cancel</v-btn
          >
          <v-btn
            color="primary"
            :loading="singleSaving"
            @click="saveSingleExpenditure"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ editMode ? "Update" : "Save" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- BULK ADD DIALOG -->
    <v-dialog v-model="bulkDialog" max-width="1200px" persistent>
      <v-card class="d-flex flex-column" style="height: 100vh">
        <!-- HEADER - Fixed -->
        <v-toolbar class="text-white" color="primary" density="comfortable">
          <v-toolbar-title> Add Multiple Expenditures </v-toolbar-title>
          <v-spacer />
          <v-btn
            color="white"
            icon="mdi-close"
            variant="text"
            @click="closeBulkDialog"
          />
        </v-toolbar>

        <!-- CONTENT - Scrollable -->
        <v-card-text class="pa-4 flex-grow-1" style="overflow-y: auto">
          <v-alert class="mb-4" type="info" variant="tonal">
            <strong>Quick Add Mode</strong> - Add multiple expenditures at once.
            Each row will be saved as a separate expenditure record.
          </v-alert>

          <!-- Bulk Options -->
          <v-card class="mb-4" elevation="1">
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-switch
                    v-model="bulkOptions.sameDates"
                    color="primary"
                    hide-details
                    label="Use same dates for all rows"
                    @update:model-value="handleSameDatesToggle"
                  />
                  <div v-if="bulkOptions.sameDates" class="mt-4">
                    <v-row dense>
                      <v-col cols="12" md="6">
                        <div class="d-flex flex-column">
                          <label class="text-caption text-grey mb-1"
                            >Start Date</label
                          >
                          <VueDatePicker
                            v-model="bulkOptions.commonStartDate"
                            auto-apply
                            class="border rounded-lg px-2 py-1 w-100"
                            format="dd-MM-yyyy"
                            model-type="format"
                            placeholder="Start Date"
                            :teleport="true"
                            @update:model-value="applyCommonStartDate"
                          />
                        </div>
                      </v-col>
                      <v-col cols="12" md="6">
                        <div class="d-flex flex-column">
                          <label class="text-caption text-grey mb-1"
                            >End Date</label
                          >
                          <VueDatePicker
                            v-model="bulkOptions.commonEndDate"
                            auto-apply
                            class="border rounded-lg px-2 py-1 w-100"
                            format="dd-MM-yyyy"
                            model-type="format"
                            placeholder="End Date"
                            :teleport="true"
                            @update:model-value="applyCommonEndDate"
                          />
                        </div>
                      </v-col>
                    </v-row>
                  </div>
                </v-col>
                <v-col cols="12" md="6">
                  <v-alert
                    v-if="bulkOptions.sameDates"
                    density="compact"
                    type="info"
                    variant="tonal"
                  >
                    All rows will use the same start and end dates
                  </v-alert>
                  <v-alert v-else density="compact" type="info" variant="tonal">
                    Each row can have different dates
                  </v-alert>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Bulk Form Controls -->
          <v-card class="mb-4" elevation="1">
            <v-card-actions class="pa-3">
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                @click="addBulkRow"
              >
                Add Row
              </v-btn>
              <v-btn
                color="secondary"
                prepend-icon="mdi-content-copy"
                @click="duplicateLastRow"
              >
                Duplicate Last Row
              </v-btn>
              <v-btn
                color="grey"
                prepend-icon="mdi-delete"
                @click="clearAllBulkRows"
              >
                Clear All
              </v-btn>
              <v-spacer />
              <div class="text-body-1 font-weight-medium">
                {{ bulkForm.length }} row(s) • Total:
                {{ formatCurrency(calculateBulkTotal()) }}
              </div>
            </v-card-actions>
          </v-card>

          <!-- Bulk Form Table -->
          <v-card class="mb-4" elevation="1">
            <v-table density="comfortable" fixed-header height="500px">
              <thead>
                <tr>
                  <th width="50">#</th>
                  <th width="250">Cost Type *</th>
                  <th v-if="!bulkOptions.sameDates" width="150">
                    Start Date *
                  </th>
                  <th v-if="!bulkOptions.sameDates" width="150">End Date *</th>
                  <th v-if="bulkOptions.sameDates" width="150">Dates</th>
                  <th width="150">Amount *</th>
                  <th>Description</th>
                  <th width="50">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, index) in bulkForm"
                  :key="index"
                  :class="hasBulkRowError(index) ? 'error-row' : ''"
                >
                  <td class="text-center">
                    <span class="font-weight-medium">{{ index + 1 }}</span>
                  </td>
                  <td>
                    <v-autocomplete
                      v-model="row.type_id"
                      density="compact"
                      :error="hasBulkFieldError(index, 'type_id')"
                      hide-details
                      item-title="name"
                      item-value="id"
                      :items="costTypes"
                      variant="outlined"
                      @blur="validateBulkField(index, 'type_id')"
                      @update:model-value="clearBulkError(index, 'type_id')"
                    />
                    <div
                      v-if="hasBulkFieldError(index, 'type_id')"
                      class="text-caption text-error mt-1"
                    >
                      {{ getBulkError(index, "type_id") }}
                    </div>
                  </td>

                  <!-- Individual Dates (when sameDates is false) -->
                  <td v-if="!bulkOptions.sameDates">
                    <div class="d-flex flex-column">
                      <VueDatePicker
                        v-model="row.start_date"
                        auto-apply
                        :class="[
                          'border',
                          'rounded-lg',
                          'px-2',
                          'py-1',
                          hasBulkFieldError(index, 'start_date')
                            ? 'error-field'
                            : '',
                        ]"
                        format="dd-MM-yyyy"
                        model-type="format"
                        placeholder="Start Date"
                        :teleport="true"
                        @blur="validateBulkField(index, 'start_date')"
                        @update:model-value="
                          clearBulkError(index, 'start_date')
                        "
                      />
                      <div
                        v-if="hasBulkFieldError(index, 'start_date')"
                        class="text-caption text-error mt-1"
                      >
                        {{ getBulkError(index, "start_date") }}
                      </div>
                    </div>
                  </td>

                  <td v-if="!bulkOptions.sameDates">
                    <div class="d-flex flex-column">
                      <VueDatePicker
                        v-model="row.end_date"
                        auto-apply
                        :class="[
                          'border',
                          'rounded-lg',
                          'px-2',
                          'py-1',
                          hasBulkFieldError(index, 'end_date')
                            ? 'error-field'
                            : '',
                        ]"
                        format="dd-MM-yyyy"
                        model-type="format"
                        placeholder="End Date"
                        :teleport="true"
                        @blur="validateBulkField(index, 'end_date')"
                        @update:model-value="validateBulkDateRange(index)"
                      />
                      <div
                        v-if="hasBulkFieldError(index, 'end_date')"
                        class="text-caption text-error mt-1"
                      >
                        {{ getBulkError(index, "end_date") }}
                      </div>
                    </div>
                  </td>

                  <!-- Common Dates Display (when sameDates is true) -->
                  <td v-if="bulkOptions.sameDates">
                    <div class="text-caption text-grey text-center">
                      <div class="font-weight-medium">
                        {{ bulkOptions.commonStartDate || "Not set" }}
                      </div>
                      <div class="text-xs">to</div>
                      <div class="font-weight-medium">
                        {{ bulkOptions.commonEndDate || "Not set" }}
                      </div>
                    </div>
                  </td>

                  <!-- Amount field -->
                  <td>
                    <v-text-field
                      v-model.number="row.amount"
                      density="compact"
                      :error="hasBulkFieldError(index, 'amount')"
                      hide-details
                      prefix="$"
                      type="number"
                      variant="outlined"
                      @blur="validateBulkField(index, 'amount')"
                      @input="clearBulkError(index, 'amount')"
                    />
                    <div
                      v-if="hasBulkFieldError(index, 'amount')"
                      class="text-caption text-error mt-1"
                    >
                      {{ getBulkError(index, "amount") }}
                    </div>
                  </td>

                  <!-- Description field -->
                  <td>
                    <v-text-field
                      v-model="row.description"
                      density="compact"
                      hide-details
                      variant="outlined"
                    />
                  </td>

                  <td class="text-center">
                    <v-btn
                      color="red"
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      @click="removeBulkRow(index)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card>

          <!-- Validation Summary -->
          <v-row>
            <v-col cols="12" md="6">
              <v-card elevation="1">
                <v-card-text>
                  <div class="d-flex align-center">
                    <v-icon
                      class="mr-2"
                      :color="getBulkValidationStatus().valid ? 'green' : 'red'"
                    >
                      {{
                        getBulkValidationStatus().valid
                          ? "mdi-check-circle"
                          : "mdi-alert-circle"
                      }}
                    </v-icon>
                    <div>
                      <div class="text-subtitle-2">
                        {{
                          getBulkValidationStatus().valid
                            ? "All rows are valid"
                            : "Validation Issues"
                        }}
                      </div>
                      <div class="text-caption text-grey">
                        {{ getBulkValidationStatus().validCount }} valid,
                        {{ getBulkValidationStatus().invalidCount }} invalid
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card elevation="1">
                <v-card-text>
                  <div class="text-subtitle-2">Summary</div>
                  <div class="d-flex justify-space-between mt-2">
                    <div class="text-caption text-grey">Total Rows:</div>
                    <div class="text-body-2 font-weight-medium">
                      {{ bulkForm.length }}
                    </div>
                  </div>
                  <div class="d-flex justify-space-between">
                    <div class="text-caption text-grey">Total Amount:</div>
                    <div class="text-body-2 font-weight-medium text-primary">
                      {{ formatCurrency(calculateBulkTotal()) }}
                    </div>
                  </div>
                  <div
                    v-if="bulkOptions.sameDates"
                    class="d-flex justify-space-between"
                  >
                    <div class="text-caption text-grey">Dates:</div>
                    <div class="text-body-2">
                      {{ bulkOptions.commonStartDate || "?" }} to
                      {{ bulkOptions.commonEndDate || "?" }}
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>

        <!-- FOOTER - Fixed -->
        <v-divider />
        <v-card-actions class="pa-4 bg-grey-lighten-4" style="flex-shrink: 0">
          <v-spacer />
          <v-btn color="grey" variant="outlined" @click="closeBulkDialog">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :disabled="
              !getBulkValidationStatus().valid || bulkForm.length === 0
            "
            :loading="bulkSaving"
            prepend-icon="mdi-content-save-all"
            @click="saveBulkExpenditures"
          >
            Save All ({{ bulkForm.length }})
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
import moment from "moment";

/* STATE */
const itemsPerPage = ref(10);
const expenditures = ref([]);
const costTypes = ref([]);
const singleFormRef = ref(null);
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
const totalRecords = ref(0);
const singleDialog = ref(false);
const bulkDialog = ref(false);
const editMode = ref(false);
const loading = ref(false);
const singleSaving = ref(false);
const bulkSaving = ref(false);

// Bulk options
const bulkOptions = reactive({
  sameDates: false,
  commonStartDate: "",
  commonEndDate: "",
});

// Single form
const singleForm = reactive({
  id: null,
  type_id: "",
  start_date: "",
  end_date: "",
  amount: "",
  description: "",
});

const singleErrors = reactive({
  type_id: "",
  start_date: "",
  end_date: "",
  amount: "",
});

// Bulk form
const bulkForm = ref([]);
const bulkErrors = ref([]); // Array of error objects for each row

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

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

/* SINGLE FORM VALIDATIONS */
function validateSingleField(field) {
  switch (field) {
    case "type_id":
      singleErrors.type_id = !singleForm.type_id ? "Cost type is required" : "";
      break;
    case "start_date":
      singleErrors.start_date = !singleForm.start_date
        ? "Start date is required"
        : "";
      break;
    case "end_date":
      singleErrors.end_date = !singleForm.end_date
        ? "End date is required"
        : "";
      if (singleForm.start_date && singleForm.end_date) {
        validateSingleDateRange();
      }
      break;
    case "amount":
      if (!singleForm.amount && singleForm.amount !== 0) {
        singleErrors.amount = "Amount is required";
      } else if (!Number.isInteger(Number(singleForm.amount))) {
        singleErrors.amount = "Amount must be a whole number";
      } else if (singleForm.amount < 0) {
        singleErrors.amount = "Amount must be positive";
      } else {
        singleErrors.amount = "";
      }
      break;
  }
}

function validateSingleDateRange() {
  if (singleForm.start_date && singleForm.end_date) {
    const start = moment(singleForm.start_date, "DD-MM-YYYY");
    const end = moment(singleForm.end_date, "DD-MM-YYYY");
    if (end.isBefore(start)) {
      singleErrors.end_date = "End date cannot be before start date";
    } else {
      clearSingleError("end_date");
    }
  }
}

function clearSingleError(field) {
  singleErrors[field] = "";
}

function validateSingleForm() {
  validateSingleField("type_id");
  validateSingleField("start_date");
  validateSingleField("end_date");
  validateSingleField("amount");

  return (
    !singleErrors.type_id &&
    !singleErrors.start_date &&
    !singleErrors.end_date &&
    !singleErrors.amount
  );
}

/* BULK FORM FUNCTIONS */
function initializeBulkForm() {
  bulkForm.value = [];
  bulkErrors.value = [];
  bulkOptions.sameDates = false;
  bulkOptions.commonStartDate = "";
  bulkOptions.commonEndDate = "";
  // Start with 3 empty rows
  for (let i = 0; i < 3; i++) {
    addBulkRow();
  }
}

function addBulkRow() {
  const newRow = {
    type_id: "",
    start_date: bulkOptions.sameDates ? bulkOptions.commonStartDate : "",
    end_date: bulkOptions.sameDates ? bulkOptions.commonEndDate : "",
    amount: "",
    description: "",
  };
  bulkForm.value.push(newRow);
  bulkErrors.value.push({
    type_id: "",
    start_date: "",
    end_date: "",
    amount: "",
  });
}

function removeBulkRow(index) {
  bulkForm.value.splice(index, 1);
  bulkErrors.value.splice(index, 1);
}

function clearAllBulkRows() {
  bulkForm.value = [];
  bulkErrors.value = [];
}

function duplicateLastRow() {
  if (bulkForm.value.length === 0) {
    addBulkRow();
    return;
  }

  const lastRow = { ...bulkForm.value[bulkForm.value.length - 1] };
  bulkForm.value.push(lastRow);
  bulkErrors.value.push({
    type_id: "",
    start_date: "",
    end_date: "",
    amount: "",
  });
}

function handleSameDatesToggle() {
  if (bulkOptions.sameDates) {
    // When enabling same dates, apply common dates to all rows
    bulkForm.value.forEach((row) => {
      row.start_date = bulkOptions.commonStartDate;
      row.end_date = bulkOptions.commonEndDate;
    });
  } else {
    // When disabling same dates, clear date validation errors
    bulkForm.value.forEach((row, index) => {
      clearBulkError(index, "start_date");
      clearBulkError(index, "end_date");
    });
  }
}

function applyCommonStartDate() {
  if (bulkOptions.sameDates && bulkOptions.commonStartDate) {
    bulkForm.value.forEach((row) => {
      row.start_date = bulkOptions.commonStartDate;
    });
  }
}

function applyCommonEndDate() {
  if (bulkOptions.sameDates && bulkOptions.commonEndDate) {
    bulkForm.value.forEach((row) => {
      row.end_date = bulkOptions.commonEndDate;
    });
  }
}

function hasBulkRowError(rowIndex) {
  if (!bulkErrors.value[rowIndex]) return false;
  const errors = bulkErrors.value[rowIndex];
  return (
    errors.type_id || errors.start_date || errors.end_date || errors.amount
  );
}

function hasBulkFieldError(rowIndex, field) {
  if (!bulkErrors.value[rowIndex]) return false;
  return !!bulkErrors.value[rowIndex][field];
}

function getBulkError(rowIndex, field) {
  if (bulkErrors.value[rowIndex]) {
    return bulkErrors.value[rowIndex][field];
  }
  return "";
}

function validateBulkField(rowIndex, field) {
  if (!bulkErrors.value[rowIndex]) {
    bulkErrors.value[rowIndex] = {
      type_id: "",
      start_date: "",
      end_date: "",
      amount: "",
    };
  }

  const row = bulkForm.value[rowIndex];
  const errors = bulkErrors.value[rowIndex];

  switch (field) {
    case "type_id":
      errors.type_id = !row.type_id ? "Cost type is required" : "";
      break;
    case "start_date":
      if (bulkOptions.sameDates) {
        // When same dates is enabled, check common dates
        if (!bulkOptions.commonStartDate) {
          errors.start_date = "Start date is required";
        } else {
          errors.start_date = "";
        }
      } else {
        errors.start_date = !row.start_date ? "Start date is required" : "";
      }
      break;
    case "end_date":
      if (bulkOptions.sameDates) {
        // When same dates is enabled, check common dates
        if (!bulkOptions.commonEndDate) {
          errors.end_date = "End date is required";
        } else {
          errors.end_date = "";
        }
      } else {
        errors.end_date = !row.end_date ? "End date is required" : "";
        if (row.start_date && row.end_date) {
          validateBulkDateRange(rowIndex);
        }
      }
      break;
    case "amount":
      if (!row.amount && row.amount !== 0) {
        errors.amount = "Amount is required";
      } else if (!Number.isInteger(Number(row.amount))) {
        errors.amount = "Amount must be a whole number";
      } else if (row.amount < 0) {
        errors.amount = "Amount must be positive";
      } else {
        errors.amount = "";
      }
      break;
  }
}

function validateBulkDateRange(rowIndex) {
  const row = bulkForm.value[rowIndex];
  const errors = bulkErrors.value[rowIndex];

  if (row.start_date && row.end_date) {
    const start = moment(row.start_date, "DD-MM-YYYY");
    const end = moment(row.end_date, "DD-MM-YYYY");

    if (end.isBefore(start)) {
      errors.end_date = "End date cannot be before start date";
    } else {
      errors.end_date = "";
    }
  }
}

function clearBulkError(rowIndex, field) {
  if (bulkErrors.value[rowIndex]) {
    bulkErrors.value[rowIndex][field] = "";
  }
}

function validateAllBulkRows() {
  let allValid = true;

  // Validate common dates first if sameDates is enabled
  if (bulkOptions.sameDates) {
    if (!bulkOptions.commonStartDate) {
      showSnackbar("Common start date is required", "error");
      return false;
    }
    if (!bulkOptions.commonEndDate) {
      showSnackbar("Common end date is required", "error");
      return false;
    }

    // Validate date range for common dates
    const start = moment(bulkOptions.commonStartDate, "DD-MM-YYYY");
    const end = moment(bulkOptions.commonEndDate, "DD-MM-YYYY");
    if (end.isBefore(start)) {
      showSnackbar("End date cannot be before start date", "error");
      return false;
    }
  }

  // Validate each row
  bulkForm.value.forEach((row, index) => {
    validateBulkField(index, "type_id");
    validateBulkField(index, "start_date");
    validateBulkField(index, "end_date");
    validateBulkField(index, "amount");

    const errors = bulkErrors.value[index];
    if (
      errors &&
      (errors.type_id || errors.start_date || errors.end_date || errors.amount)
    ) {
      allValid = false;
    }
  });

  return allValid;
}

function getBulkValidationStatus() {
  let validCount = 0;
  let invalidCount = 0;

  bulkErrors.value.forEach((errors) => {
    const hasErrors =
      errors &&
      (errors.type_id || errors.start_date || errors.end_date || errors.amount);
    if (hasErrors) {
      invalidCount++;
    } else {
      validCount++;
    }
  });

  // Check common dates if sameDates is enabled
  if (bulkOptions.sameDates) {
    if (!bulkOptions.commonStartDate || !bulkOptions.commonEndDate) {
      invalidCount = bulkForm.value.length; // All rows are invalid if common dates not set
      validCount = 0;
    }
  }

  return {
    valid: invalidCount === 0,
    validCount,
    invalidCount,
  };
}

function calculateBulkTotal() {
  return bulkForm.value.reduce((total, row) => {
    const amount = parseFloat(row.amount) || 0;
    return total + amount;
  }, 0);
}

/* LOADERS */
async function loadCostTypes() {
  try {
    const res = await fetch("/expenditures/types?limit=1000000");
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
    params.append("limit", itemsPerPage.value);
    const res = await fetch(`/expenditures?${params.toString()}`);
    const data = await res.json();
    expenditures.value = data.data || [];
    totalRecords.value = data.totalRecords || 0;
    await loadSummary();
  } catch (err) {
    console.error("Failed to load expenditures:", err);
    showSnackbar("Failed to load expenditures", "error");
  } finally {
    loading.value = false;
  }
}

/* DIALOG HANDLERS */
function openSingleDialog(edit = false, item = null) {
  editMode.value = edit;
  singleDialog.value = true;

  Object.keys(singleErrors).forEach((key) => (singleErrors[key] = ""));

  if (edit && item) {
    Object.assign(singleForm, {
      id: item.id,
      type_id: item.type_id,
      start_date: moment(item.start_date).format("DD-MM-YYYY"),
      end_date: moment(item.end_date).format("DD-MM-YYYY"),
      amount: item.amount,
      description: item.description,
    });
  } else {
    Object.assign(singleForm, {
      id: null,
      type_id: "",
      start_date: "",
      end_date: "",
      amount: "",
      description: "",
    });
  }
}

function closeSingleDialog() {
  singleDialog.value = false;
  Object.keys(singleErrors).forEach((key) => (singleErrors[key] = ""));
}

function openBulkDialog() {
  bulkDialog.value = true;
  initializeBulkForm();
}

function closeBulkDialog() {
  bulkDialog.value = false;
  bulkForm.value = [];
  bulkErrors.value = [];
  bulkOptions.sameDates = false;
  bulkOptions.commonStartDate = "";
  bulkOptions.commonEndDate = "";
}

/* SINGLE EXPENDITURE SAVE */
async function saveSingleExpenditure() {
  if (!validateSingleForm()) {
    showSnackbar("Please fix the validation errors", "error");
    return;
  }

  singleSaving.value = true;
  try {
    const method = editMode.value ? "PUT" : "POST";
    const url = editMode.value
      ? `/expenditures/${singleForm.id}`
      : "/expenditures";

    const payload = {
      ...singleForm,
      start_date: moment(singleForm.start_date, "DD-MM-YYYY").format(
        "YYYY-MM-DD",
      ),
      end_date: moment(singleForm.end_date, "DD-MM-YYYY").format("YYYY-MM-DD"),
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Save failed");
    }

    singleDialog.value = false;
    showSnackbar(
      `Expenditure ${editMode.value ? "updated" : "created"} successfully`,
    );
    await loadData();
  } catch (err) {
    console.error("Failed to save expenditure:", err);
    showSnackbar(err.message || "Failed to save expenditure", "error");
  } finally {
    singleSaving.value = false;
  }
}

/* BULK EXPENDITURES SAVE */
async function saveBulkExpenditures() {
  if (!validateAllBulkRows()) {
    showSnackbar("Please fix all validation errors before saving", "error");
    return;
  }

  if (bulkForm.value.length === 0) {
    showSnackbar("No expenditures to save", "error");
    return;
  }

  bulkSaving.value = true;
  try {
    // Prepare payload for bulk API
    const payload = {
      expenditures: bulkForm.value.map((row) => ({
        type_id: row.type_id,
        start_date: bulkOptions.sameDates
          ? moment(bulkOptions.commonStartDate, "DD-MM-YYYY").format(
              "YYYY-MM-DD",
            )
          : moment(row.start_date, "DD-MM-YYYY").format("YYYY-MM-DD"),
        end_date: bulkOptions.sameDates
          ? moment(bulkOptions.commonEndDate, "DD-MM-YYYY").format("YYYY-MM-DD")
          : moment(row.end_date, "DD-MM-YYYY").format("YYYY-MM-DD"),
        amount: parseFloat(row.amount),
        description: row.description || null,
      })),
    };

    const res = await fetch("/expenditures/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Bulk save failed");
    }

    const result = await res.json();

    bulkDialog.value = false;
    showSnackbar(
      `Successfully created ${result.created} expenditure(s)`,
      result.failed > 0 ? "warning" : "success",
    );

    if (result.failed > 0 && result.errors) {
      console.warn("Some expenditures failed:", result.errors);
    }

    await loadData();
  } catch (err) {
    console.error("Failed to save bulk expenditures:", err);
    showSnackbar(err.message || "Failed to save bulk expenditures", "error");
  } finally {
    bulkSaving.value = false;
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
.error-row {
  background-color: #ffebee !important;
}
</style>
