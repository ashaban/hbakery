<template>
  <v-container fluid>
    <!-- 🔍 FILTERS -->
    <v-card class="pa-4 mb-4">
      <v-row dense>
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="filters.search"
            append-inner-icon="mdi-close-circle"
            autocomplete="off"
            clearable
            label="Search Staff Name"
            @click:append-inner="filters.search = ''"
          />
        </v-col>
        <v-col cols="12" sm="3">
          <v-select
            v-model="filters.status"
            clearable
            :items="['Active', 'Resigned', 'Terminated']"
            label="Filter by Status"
          />
        </v-col>
        <v-col cols="12" sm="3">
          <DateField v-model="filters.hiredDate" placeholder="From" />
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

    <!-- 📊 HEADER -->
    <div class="d-flex justify-space-between mb-4">
      <h3>Staff Management</h3>
      <div>
        <v-btn
          v-if="$store.getters.hasTask('can_add_staffs')"
          class="text-white mr-2"
          color="primary"
          size="small"
          @click="activateAddDialog"
        >
          <v-icon start>mdi-plus</v-icon> Add Staff
        </v-btn>
      </div>
    </div>

    <!-- LOADING BAR -->
    <v-progress-linear :active="loading" :indeterminate="loading" />

    <!-- STAFF TABLE -->
    <v-data-table-server
      v-model:items-per-page="itemsPerPage"
      v-model:page="page"
      class="elevation-1"
      dense
      :headers="headers"
      :items="values"
      :items-length="totalRecords"
      :items-per-page-options="[5, 10, 20, 50, 100]"
      :loading="loading"
      @update:options="loadValues"
    >
      <template #item.salary="{ item }">
        {{ formatCurrency(item.salary) }}
      </template>

      <template #item.daily_salary="{ item }">
        <span v-if="item.daily_salary">{{ formatCurrency(item.daily_salary) }}</span>
        <span v-else class="text-grey text-caption">Not set</span>
      </template>

      <template #item.hired_at="{ item }">
        {{ formatDate(item.hired_at) }}
      </template>

      <template #item.status="{ item }">
        <v-chip :color="statusColor(item.status)" label size="small">
          {{ item.status }}
        </v-chip>
      </template>

      <template
        v-if="$store.getters.hasTask('can_edit_staffs')"
        #item.actions="{ item }"
      >
        <v-icon
          class="mr-2"
          color="info"
          title="View Details"
          @click="viewStaffDetails(item)"
        >
          mdi-eye
        </v-icon>
        <v-icon
          v-if="item.status === 'Active'"
          class="mr-2"
          color="warning"
          title="End Contract"
          @click="activateEndContractDialog(item)"
        >
          mdi-account-arrow-right
        </v-icon>
        <v-icon
          v-else
          class="mr-2"
          color="success"
          title="Rehire Staff"
          @click="activateRehireDialog(item)"
        >
          mdi-account-arrow-left
        </v-icon>
        <v-icon color="primary" @click="activateEditDialog(item)">
          mdi-square-edit-outline
        </v-icon>
      </template>
    </v-data-table-server>

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
            <v-icon class="mr-2 text-white">mdi-account</v-icon>
            <span class="text-white font-weight-bold text-h6">
              {{ isEditing ? "Edit Staff" : "Add Staff" }}
            </span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="dialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-text-field
              v-model="state.name"
              autocomplete="off"
              bg-color="#E0E0E0"
              :error-messages="v$.name.$errors.map((e) => e.$message)"
              label="Full Name"
              required
              @blur="v$.name.$touch"
            />

            <v-text-field
              v-model="state.phone"
              autocomplete="off"
              bg-color="#E0E0E0"
              label="Phone Number"
            />

            <v-text-field
              v-model="state.position"
              autocomplete="off"
              bg-color="#E0E0E0"
              label="Position"
            />

            <v-text-field
              v-model="state.salary"
              autocomplete="off"
              bg-color="#E0E0E0"
              :error-messages="v$.salary.$errors.map((e) => e.$message)"
              label="Monthly Salary (TSh)"
              required
              type="number"
              @blur="v$.salary.$touch"
            />

            <v-text-field
              v-model="state.daily_salary"
              autocomplete="off"
              bg-color="#E0E0E0"
              hint="What one day of this person's time costs. Used to price production shifts."
              label="Daily Rate (TSh)"
              persistent-hint
              type="number"
            />

            <div class="mb-4">
              <label class="v-label text-body-2 mb-2">Hired Date *</label>
              <DateField
                v-model="state.hired_at"
                :clearable="false"
                :error="!isValidHireDate()"
                :max-date="new Date()"
                placeholder="Select Hire Date"
                required
              />
              <div
                v-if="v$.hired_at.$error || !isValidHireDate()"
                class="text-caption text-error mt-1"
              >
                {{ v$.hired_at.$errors[0]?.$message || hireDateError }}
              </div>
            </div>

            <v-select
              v-model="state.status"
              bg-color="#E0E0E0"
              :items="['Active', 'Resigned', 'Terminated']"
              label="Status"
              readonly="true"
              required
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end">
          <v-btn
            color="success"
            :disabled="v$.$invalid || !isValidHireDate()"
            :loading="loading"
            @click="saveStaff"
          >
            <v-icon start>mdi-content-save</v-icon>
            {{ isEditing ? "Save Changes" : "Add Staff" }}
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

    <!-- END CONTRACT DIALOG -->
    <v-dialog v-model="endContractDialog" max-width="500">
      <v-card>
        <v-toolbar color="warning">
          <v-toolbar-title
            >End Contract - {{ selectedStaff?.name }}</v-toolbar-title
          >
          <v-btn
            color="white"
            icon="mdi-close"
            @click="endContractDialog = false"
          />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent="endContract">
            <div class="mb-4">
              <label class="v-label text-body-2 mb-2">End Date *</label>
              <DateField
                v-model="contractState.end_date"
                :clearable="false"
                :error="!isValidEndDate()"
                :max-date="new Date()"
                :min-date="getLastStartDate()"
                placeholder="Select End Date"
                required
              />
              <div
                v-if="!isValidEndDate()"
                class="text-caption text-error mt-1"
              >
                {{ endDateError }}
              </div>
            </div>

            <v-select
              v-model="contractState.end_reason"
              :items="[
                'Resignation',
                'Termination',
                'Contract Expired',
                'Mutual Agreement',
                'Retirement',
                'Other',
              ]"
              label="Reason for Ending Contract *"
              required
            />

            <v-textarea
              v-model="contractState.notes"
              autocomplete="off"
              label="Additional Notes"
              placeholder="Enter any additional details about the contract end..."
              rows="3"
            />

            <div class="text-caption text-grey">
              <v-icon class="mr-1" small>mdi-information</v-icon>
              This will change the staff status to the selected reason and
              record the contract end. The staff can be rehired later if needed.
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end">
          <v-btn color="grey" @click="endContractDialog = false">Cancel</v-btn>
          <v-btn
            color="warning"
            :disabled="!isValidEndDate() || !contractState.end_reason"
            :loading="loading"
            @click="endContract"
          >
            <v-icon start>mdi-account-arrow-right</v-icon> End Contract
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- REHIRE DIALOG -->
    <v-dialog v-model="rehireDialog" max-width="500">
      <v-card>
        <v-toolbar color="success">
          <v-toolbar-title
            >Rehire Staff - {{ selectedStaff?.name }}</v-toolbar-title
          >
          <v-btn color="white" icon="mdi-close" @click="rehireDialog = false" />
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-form @submit.prevent="rehireStaff">
            <v-text-field
              v-model="rehireState.position"
              autocomplete="off"
              label="Position *"
              required
            />

            <v-text-field
              v-model="rehireState.salary"
              autocomplete="off"
              label="Salary (TSh) *"
              required
              type="number"
            />

            <div class="mb-4">
              <label class="v-label text-body-2 mb-2">Rehire Date *</label>
              <DateField
                v-model="rehireState.rehire_date"
                :clearable="false"
                :error="!isValidRehireDate()"
                :max-date="new Date()"
                :min-date="getLastEndDate()"
                placeholder="Select Rehire Date"
                required
              />
              <div
                v-if="!isValidRehireDate()"
                class="text-caption text-error mt-1"
              >
                {{ rehireDateError }}
              </div>
            </div>

            <v-textarea
              v-model="rehireState.notes"
              autocomplete="off"
              label="Rehire Notes"
              placeholder="Enter any notes about the rehire..."
              rows="3"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="d-flex justify-end">
          <v-btn color="grey" @click="rehireDialog = false">Cancel</v-btn>
          <v-btn
            color="success"
            :disabled="
              !rehireState.position ||
              !rehireState.salary ||
              !isValidRehireDate()
            "
            :loading="loading"
            @click="rehireStaff"
          >
            <v-icon start>mdi-account-arrow-left</v-icon> Rehire Staff
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- STAFF DETAILS DIALOG -->
    <v-dialog v-model="staffDetailsDialog" max-width="1000">
      <v-card>
        <v-toolbar color="info">
          <v-toolbar-title
            >Staff Details - {{ selectedStaff?.name }}</v-toolbar-title
          >
          <v-btn
            color="white"
            icon="mdi-close"
            @click="staffDetailsDialog = false"
          />
        </v-toolbar>

        <v-card-text class="pt-6">
          <!-- Staff Information -->
          <v-card class="mb-6" variant="outlined">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-account</v-icon>
              Personal Information
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="6">
                  <v-list>
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold"
                        >Name:</v-list-item-title
                      >
                      <v-list-item-subtitle>{{
                        selectedStaff?.name
                      }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold"
                        >Phone:</v-list-item-title
                      >
                      <v-list-item-subtitle>{{
                        selectedStaff?.phone || "Not provided"
                      }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold"
                        >Current Status:</v-list-item-title
                      >
                      <v-list-item-subtitle>
                        <v-chip
                          :color="statusColor(selectedStaff?.status)"
                          size="small"
                        >
                          {{ selectedStaff?.status }}
                        </v-chip>
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
                <v-col cols="6">
                  <v-list>
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold"
                        >Position:</v-list-item-title
                      >
                      <v-list-item-subtitle>{{
                        selectedStaff?.position || "Not specified"
                      }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold"
                        >Salary:</v-list-item-title
                      >
                      <v-list-item-subtitle>{{
                        formatCurrency(selectedStaff?.salary)
                      }}</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title class="font-weight-bold"
                        >Last Hired Date:</v-list-item-title
                      >
                      <v-list-item-subtitle>{{
                        formatDate(selectedStaff?.hired_at)
                      }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Contract History -->
          <v-card variant="outlined">
            <v-card-title class="text-h6">
              <v-icon class="mr-2">mdi-history</v-icon>
              Contract History
            </v-card-title>
            <v-card-text>
              <v-data-table
                class="elevation-1"
                :headers="staffContractHeaders"
                :items="staffContractHistory"
                :loading="loading"
              >
                <template #item.start_date="{ item }">
                  {{ formatDate(item.start_date) }}
                </template>
                <template #item.end_date="{ item }">
                  {{
                    item.end_date
                      ? formatDate(item.end_date)
                      : item.display_end_date
                  }}
                </template>
                <template #item.salary="{ item }">
                  {{ formatCurrency(item.salary) }}
                </template>
                <template #item.end_reason="{ item }">
                  <v-chip
                    v-if="item.end_reason"
                    :color="getEndReasonColor(item.end_reason)"
                    size="small"
                  >
                    {{ item.end_reason }}
                  </v-chip>
                  <span v-else class="text-grey">{{
                    item.display_status
                  }}</span>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-card-text>
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
          <v-btn color="error" @click="removeStaff">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useVuelidate } from "@vuelidate/core";
import { minValue, required } from "@vuelidate/validators";
import { useStore } from "vuex";
import { formatDMY, parseFlexibleDMY } from "@/utils/date.js";
import DateField from "@/components/shared/DateField.vue";

// store
const itemsPerPage = ref(10);
const store = useStore();
const loading = ref(false);
const dialog = ref(false);
const confirmDeleteDialog = ref(false);
const isEditing = ref(false);
const editingId = ref(null);
const endContractDialog = ref(false);
const rehireDialog = ref(false);
const showContractHistory = ref(false);
const staffDetailsDialog = ref(false);

// pagination & data
const page = ref(1);
const totalRecords = ref(0);
const limit = 10;
const values = ref([]);
const totals = reactive({ total_staff: "" });
const contractHistory = ref([]);
const staffContractHistory = ref([]);
const selectedStaff = ref(null);

// filters
const filters = reactive({
  search: "",
  status: "",
  hiredDate: null,
});

// table headers
const headers = [
  { title: "Name", key: "name" },
  { title: "Phone", key: "phone" },
  { title: "Position", key: "position" },
  { title: "Monthly Salary", key: "salary" },
  { title: "Daily Rate", key: "daily_salary" },
  { title: "Last Hired Date", key: "hired_at" },
  { title: "Status", key: "status" },
  { title: "Actions", key: "actions", sortable: false },
];

// contract history headers (global)
const contractHistoryHeaders = [
  { title: "Staff Name", key: "staff_name" },
  { title: "Position", key: "position" },
  { title: "Salary", key: "salary" },
  { title: "Start Date", key: "start_date" },
  { title: "End Date", key: "end_date" },
  { title: "End Reason", key: "end_reason" },
  { title: "Notes", key: "notes" },
];

// staff contract headers (for individual staff)
const staffContractHeaders = [
  { title: "Position", key: "position" },
  { title: "Salary", key: "salary" },
  { title: "Start Date", key: "start_date" },
  { title: "End Date", key: "end_date" },
  { title: "End Reason", key: "end_reason" },
  { title: "Notes", key: "notes" },
];

// form state
const state = reactive({
  name: "",
  phone: "",
  position: "",
  salary: "",
  daily_salary: "",
  status: "Active",
  hired_at: formatDMY(new Date()), // Default to today
});

// contract state for ending contract
const contractState = reactive({
  end_date: formatDMY(new Date()),
  end_reason: "Resignation",
  notes: "",
});

// rehire state
const rehireState = reactive({
  position: "",
  salary: "",
  daily_salary: "",
  rehire_date: formatDMY(new Date()),
  notes: "",
});

// validation
const rules = {
  name: { required },
  salary: { required, minValue: minValue(0) },
  hired_at: { required },
};
const v$ = useVuelidate(rules, state);

// computed properties for validation
const hireDateError = computed(() => {
  if (!state.hired_at) return "Hire date is required";

  const hireDate = parseDateString(state.hired_at);
  if (!hireDate) return "Invalid date format";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (hireDate > today) {
    return "Hire date cannot be in the future";
  }

  return "";
});

const endDateError = computed(() => {
  if (!contractState.end_date) return "End date is required";

  const endDate = parseDateString(contractState.end_date);
  const lastStartDate = getLastStartDate();

  if (!endDate) return "Invalid date format";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (endDate > today) {
    return "End date cannot be in the future";
  }

  if (lastStartDate && endDate < lastStartDate) {
    return `End date must be on or after ${formatDate(lastStartDate)}`;
  }

  return "";
});

const rehireDateError = computed(() => {
  if (!rehireState.rehire_date) return "Rehire date is required";

  const rehireDate = parseDateString(rehireState.rehire_date);
  const lastEndDate = getLastEndDate();

  if (!rehireDate) return "Invalid date format";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (rehireDate > today) {
    return "Rehire date cannot be in the future";
  }

  if (lastEndDate && rehireDate < lastEndDate) {
    return `Rehire date must be on or after ${formatDate(lastEndDate)}`;
  }

  return "";
});

// helpers
const formatCurrency = (val) =>
  val
    ? Number(val).toLocaleString("en-US", { minimumFractionDigits: 0 }) + " TSh"
    : "0 TSh";

const formatDate = (dateInput) => formatDMY(dateInput);

const parseDateString = (dateString) => parseFlexibleDMY(dateString);

const statusColor = (status) => {
  switch (status) {
    case "Active":
      return "green";
    case "Resigned":
      return "orange";
    case "Terminated":
      return "red";
    default:
      return "grey";
  }
};

const getEndReasonColor = (reason) => {
  switch (reason) {
    case "Termination":
      return "red";
    case "Resignation":
      return "orange";
    case "Contract Expired":
      return "blue";
    case "Retirement":
      return "purple";
    default:
      return "grey";
  }
};

// date validation functions
const isValidHireDate = () => {
  return !hireDateError.value && state.hired_at;
};

const isValidEndDate = () => {
  return !endDateError.value && contractState.end_date;
};

const isValidRehireDate = () => {
  return !rehireDateError.value && rehireState.rehire_date;
};

const getLastStartDate = () => {
  if (!selectedStaff.value) return null;

  // For existing staff, use their current hired_at date
  const lastHireDate = selectedStaff.value.hired_at;
  return parseDateString(lastHireDate);
};

const getLastEndDate = () => {
  if (!selectedStaff.value) return null;

  // For staff being rehired, we need to get their last end date from contract history
  // This will be loaded when we open the rehire dialog
  if (selectedStaff.value.last_end_date) {
    return parseDateString(selectedStaff.value.last_end_date);
  }

  return null;
};

// load data
async function loadValues() {
  loading.value = true;
  const params = new URLSearchParams({
    page: page.value,
    limit: itemsPerPage.value,
  });
  if (filters.search) params.append("search", filters.search);
  if (filters.status) params.append("status", filters.status);
  if (filters.hiredDate) {
    // Format date to YYYY-MM-DD for backend
    const date = new Date(filters.hiredDate);
    const formattedDate = date.toISOString().split("T")[0];
    params.append("hired_at", formattedDate);
  }

  try {
    const res = await fetch(`/staffs?${params.toString()}`);
    const data = await res.json();
    values.value = data.data || [];
    totals.total_staff = data.totalRecords || 0;
    totalRecords.value = data.totalRecords || 0;
  } catch (err) {
    console.error(err);
    store.commit("setMessage", { type: "error", text: "Failed to load staff" });
  } finally {
    loading.value = false;
  }
}

// load contract history
async function loadContractHistory() {
  loading.value = true;
  try {
    const res = await fetch("/staffs/contracts/history");
    const data = await res.json();
    contractHistory.value = data.data || [];
  } catch (err) {
    console.error(err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load contract history",
    });
  } finally {
    loading.value = false;
  }
}

// load staff contract history
async function loadStaffContractHistory(staffId) {
  loading.value = true;
  try {
    const res = await fetch(`/staffs/${staffId}/contracts`);
    const data = await res.json();
    staffContractHistory.value = data.data || [];

    // Find the last end date for rehire validation
    if (data.data && data.data.length > 0) {
      const lastContract =
        data.data.find((contract) => contract.end_date) || data.data[0];
      if (lastContract && lastContract.end_date) {
        selectedStaff.value.last_end_date = lastContract.end_date;
      }
    }
  } catch (err) {
    console.error(err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load staff contract history",
    });
  } finally {
    loading.value = false;
  }
}

// filter actions
function applyFilters() {
  page.value = 1;
  loadValues();
}
function resetFilters() {
  filters.search = "";
  filters.status = "";
  filters.hiredDate = null;
  page.value = 1;
  loadValues();
}

// dialogs
function activateAddDialog() {
  isEditing.value = false;
  Object.assign(state, {
    name: "",
    phone: "",
    position: "",
    salary: "",
  daily_salary: "",
    status: "Active",
    hired_at: "", // Default to today
  });
  dialog.value = true;
  v$.value.$reset();
}

function activateEditDialog(item) {
  isEditing.value = true;
  editingId.value = item.id;
  Object.assign(state, {
    ...item,
    hired_at: item.hired_at || formatDMY(new Date()),
  });
  dialog.value = true;
  v$.value.$reset();
}

async function activateEndContractDialog(item) {
  selectedStaff.value = item;
  Object.assign(contractState, {
    end_date: formatDMY(new Date()),
    end_reason: "Resignation",
    notes: "",
  });
  endContractDialog.value = true;
}

async function activateRehireDialog(item) {
  selectedStaff.value = item;
  Object.assign(rehireState, {
    position: item.position || "",
    salary: item.salary || "",
    daily_salary: item.daily_salary || "",
    rehire_date: formatDMY(new Date()),
    notes: "",
  });

  // Load contract history to get last end date
  await loadStaffContractHistory(item.id);
  rehireDialog.value = true;
}

async function viewStaffDetails(item) {
  selectedStaff.value = item;
  await loadStaffContractHistory(item.id);
  staffDetailsDialog.value = true;
}

// end contract
async function endContract() {
  if (
    !contractState.end_date ||
    !contractState.end_reason ||
    !isValidEndDate()
  ) {
    store.commit("setMessage", {
      type: "error",
      text: "Please fix the validation errors",
    });
    return;
  }

  loading.value = true;
  try {
    const formData = new FormData();
    formData.append("staff_id", selectedStaff.value.id);
    formData.append("end_date", contractState.end_date);

    formData.append("end_reason", contractState.end_reason);
    formData.append("notes", contractState.notes);
    formData.append(
      "status",
      contractState.end_reason === "Resignation" ? "Resigned" : "Terminated",
    );

    const res = await fetch("/staffs/contracts/end", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Failed to end contract");

    endContractDialog.value = false;
    loadValues();
    store.commit("setMessage", {
      type: "success",
      text: `Contract ended for ${selectedStaff.value.name}`,
    });
  } catch (err) {
    console.error(err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to end contract",
    });
  } finally {
    loading.value = false;
  }
}

// rehire staff
async function rehireStaff() {
  if (
    !rehireState.position ||
    !rehireState.salary ||
    !rehireState.rehire_date ||
    !isValidRehireDate()
  ) {
    store.commit("setMessage", {
      type: "error",
      text: "Please fix the validation errors",
    });
    return;
  }

  loading.value = true;
  try {
    const formData = new FormData();
    formData.append("staff_id", selectedStaff.value.id);
    formData.append("position", rehireState.position);
    formData.append("salary", rehireState.salary);
    formData.append("rehire_date", rehireState.rehire_date);

    formData.append("notes", rehireState.notes);

    const res = await fetch("/staffs/contracts/rehire", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Failed to rehire staff");

    rehireDialog.value = false;
    loadValues();
    store.commit("setMessage", {
      type: "success",
      text: `${selectedStaff.value.name} rehired successfully`,
    });
  } catch (err) {
    console.error(err);
    store.commit("setMessage", {
      type: "error",
      text: "Failed to rehire staff",
    });
  } finally {
    loading.value = false;
  }
}

// save
async function saveStaff() {
  v$.value.$touch();
  if (v$.value.$invalid || !isValidHireDate()) return;

  loading.value = true;
  const formData = new FormData();
  formData.append("name", state.name);
  formData.append("phone", state.phone);
  formData.append("position", state.position);
  formData.append("salary", state.salary);
  formData.append("daily_salary", state.daily_salary ?? "");
  formData.append("status", state.status);
  formData.append("hired_at", state.hired_at);

  const url = isEditing.value ? `/staffs/${editingId.value}` : "/staffs";
  const method = isEditing.value ? "PUT" : "POST";

  try {
    const res = await fetch(url, { method, body: formData });
    if (!res.ok) throw new Error("Failed to save");
    dialog.value = false;
    loadValues();
    store.commit("setMessage", {
      type: "success",
      text: isEditing.value ? "Staff updated!" : "Staff added!",
    });
  } catch {
    store.commit("setMessage", { type: "error", text: "Failed to save staff" });
  } finally {
    loading.value = false;
  }
}

// delete
async function removeStaff() {
  loading.value = true;
  try {
    await fetch(`/staffs/${editingId.value}`, { method: "DELETE" });
    confirmDeleteDialog.value = false;
    dialog.value = false;
    loadValues();
    store.commit("setMessage", { type: "success", text: "Staff deleted!" });
  } catch {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to delete staff",
    });
  } finally {
    loading.value = false;
  }
}

// Show contract history
async function showHistory() {
  await loadContractHistory();
  showContractHistory.value = true;
}

onMounted(() => loadValues());
</script>

<style scoped>
.v-alert strong {
  font-weight: 600;
}

</style>
