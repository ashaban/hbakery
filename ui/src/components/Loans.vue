<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-hand-coin</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">Loans</h1>
                <p class="text-body-1 text-grey mt-1">
                  Money lent to staff (recoverable via salary) and to
                  people outside the company
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-chip class="mr-3" color="error" size="large" variant="flat">
              Outstanding: {{ money(totalOutstanding) }}
            </v-chip>
            <v-btn
              v-if="$store.getters.hasTask('can_add_loan')"
              color="primary"
              size="large"
              @click="openAddDialog"
            >
              <v-icon start>mdi-plus</v-icon>
              New Loan
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
              v-model="search"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="Search name"
              prepend-inner-icon="mdi-magnify"
              spellcheck="false"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="type"
              clearable
              density="comfortable"
              :items="[
                { title: 'All', value: '' },
                { title: 'Staff', value: 'staff' },
                { title: 'External', value: 'external' },
              ]"
              label="Type"
              prepend-inner-icon="mdi-filter"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="onlyOutstanding"
              density="comfortable"
              :items="[
                { title: 'Outstanding only', value: true },
                { title: 'All loans (incl. settled)', value: false },
              ]"
              label="Show"
              prepend-inner-icon="mdi-eye"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex" cols="12" sm="3">
            <v-btn
              class="mr-2"
              color="primary"
              :loading="loading"
              variant="flat"
              @click="loadLoans"
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
      <v-table density="comfortable">
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="text-left font-weight-bold text-grey">BORROWER</th>
            <th class="text-center font-weight-bold text-grey">TYPE</th>
            <th class="text-left font-weight-bold text-grey">DATE</th>
            <th class="text-right font-weight-bold text-grey">AMOUNT</th>
            <th class="text-right font-weight-bold text-grey">REPAID</th>
            <th class="text-right font-weight-bold text-grey">BALANCE</th>
            <th class="text-right font-weight-bold text-grey">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in loans" :key="l.id">
            <td class="text-left">
              <div class="font-weight-medium">{{ l.party_name }}</div>
              <div v-if="l.reason" class="text-caption text-grey">
                {{ l.reason }}
              </div>
            </td>
            <td class="text-center">
              <v-chip
                :color="l.type === 'staff' ? 'primary' : 'orange'"
                size="small"
                variant="flat"
              >
                {{ l.type === "staff" ? "Staff" : "External" }}
              </v-chip>
            </td>
            <td class="text-left">{{ formatDate(l.loan_date) }}</td>
            <td class="text-right">{{ money(l.amount) }}</td>
            <td class="text-right">{{ money(l.repaid) }}</td>
            <td class="text-right">
              <v-chip
                :color="Number(l.balance) > 0 ? 'error' : 'success'"
                size="small"
                variant="flat"
              >
                {{ money(l.balance) }}
              </v-chip>
            </td>
            <td class="text-right">
              <v-btn
                v-if="
                  Number(l.balance) > 0 &&
                  $store.getters.hasTask('can_add_loan_payment')
                "
                class="mr-1"
                color="primary"
                size="small"
                variant="tonal"
                @click="openPaymentDialog(l)"
              >
                Record Payment
              </v-btn>
              <v-btn
                v-if="
                  Number(l.repaid) === 0 &&
                  $store.getters.hasTask('can_delete_loan')
                "
                color="error"
                icon
                size="small"
                variant="text"
                @click="openDeleteDialog(l)"
              >
                <v-icon>mdi-delete-outline</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="!loading && loans.length === 0" class="text-center py-12">
        <v-icon class="mb-4" color="grey" size="64">mdi-check-circle</v-icon>
        <div class="text-h6 text-grey mb-2">No loans found</div>
        <div class="text-body-1 text-grey">
          {{
            search || type
              ? "No loans match this search."
              : "No outstanding loans right now."
          }}
        </div>
      </div>
    </v-card>

    <!-- NEW LOAN DIALOG -->
    <v-dialog v-model="showAddDialog" max-width="600">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-hand-coin</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            New Loan
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showAddDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-btn-toggle
            v-model="newLoan.type"
            class="mb-4"
            color="primary"
            divided
            mandatory
            variant="outlined"
          >
            <v-btn value="staff">
              <v-icon start>mdi-account-tie</v-icon>
              Staff
            </v-btn>
            <v-btn value="external">
              <v-icon start>mdi-account</v-icon>
              External
            </v-btn>
          </v-btn-toggle>

          <v-autocomplete
            v-if="newLoan.type === 'staff'"
            v-model="newLoan.staff_id"
            density="comfortable"
            item-title="name"
            item-value="id"
            :items="staffList"
            label="Staff Member"
            prepend-inner-icon="mdi-account-tie"
            variant="outlined"
          />

          <template v-else>
            <v-combobox
              auto-select-first="false"
              clearable
              density="comfortable"
              hide-no-data
              item-title="name"
              item-value="id"
              :items="borrowers"
              label="Borrower (existing or type a new name)"
              :model-value="newLoan.borrowerSelection"
              prepend-inner-icon="mdi-account"
              return-object
              variant="outlined"
              @update:model-value="onBorrowerChange"
              @update:search="onBorrowerSearch"
            />
            <v-text-field
              v-if="isNewBorrower"
              v-model="newLoan.borrower_phone"
              autocomplete="off"
              autocorrect="off"
              density="comfortable"
              label="Phone (optional)"
              prepend-inner-icon="mdi-phone"
              spellcheck="false"
              variant="outlined"
            />
          </template>

          <v-text-field
            v-model="newLoan.amount"
            autocomplete="off"
            autocorrect="off"
            density="comfortable"
            label="Amount"
            prepend-inner-icon="mdi-cash"
            spellcheck="false"
            type="number"
            variant="outlined"
          />
          <v-text-field
            v-model="newLoan.loan_date"
            autocomplete="off"
            autocorrect="off"
            density="comfortable"
            label="Date"
            prepend-inner-icon="mdi-calendar"
            spellcheck="false"
            type="date"
            variant="outlined"
          />
          <v-textarea
            v-model="newLoan.reason"
            density="comfortable"
            label="Reason (optional)"
            rows="2"
            variant="outlined"
          />
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="showAddDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!canSaveLoan"
            :loading="saving"
            size="large"
            variant="flat"
            @click="submitLoan"
          >
            <v-icon start>mdi-check</v-icon>
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- PAYMENT DIALOG -->
    <v-dialog v-model="showPaymentDialog" max-width="500">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-cash-plus</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Record Repayment
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showPaymentDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-6">
          <div class="text-body-1 mb-4">
            <strong>{{ paymentTarget?.party_name }}</strong> owes
            <strong>{{ money(paymentTarget?.balance) }}</strong>
          </div>
          <v-text-field
            v-model="paymentForm.amount"
            autocomplete="off"
            autocorrect="off"
            density="comfortable"
            label="Amount"
            spellcheck="false"
            type="number"
            variant="outlined"
          />
          <v-select
            v-model="paymentForm.method"
            density="comfortable"
            :items="paymentMethods"
            label="Method"
            variant="outlined"
          />
          <v-text-field
            v-model="paymentForm.reference"
            autocomplete="off"
            autocorrect="off"
            density="comfortable"
            label="Reference (optional)"
            spellcheck="false"
            variant="outlined"
          />
          <v-text-field
            v-model="paymentForm.repayment_date"
            autocomplete="off"
            autocorrect="off"
            density="comfortable"
            label="Date"
            spellcheck="false"
            type="date"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            size="large"
            variant="outlined"
            @click="showPaymentDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!paymentForm.amount"
            :loading="recordingPayment"
            size="large"
            variant="flat"
            @click="submitPayment"
          >
            <v-icon start>mdi-check</v-icon>
            Record
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- DELETE DIALOG -->
    <v-dialog v-model="showDeleteConfirm" max-width="500">
      <v-card class="rounded-lg">
        <v-toolbar color="error" density="comfortable">
          <v-avatar class="mr-3" color="error" size="40">
            <v-icon color="white">mdi-alert</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Confirm Deletion
          </v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pa-6 text-center">
          <v-icon class="mb-4" color="error" size="64">mdi-delete-alert</v-icon>
          <div class="text-h5 font-weight-bold mb-2">Delete Loan?</div>
          <div class="text-body-1 text-grey mb-4">
            Delete the {{ money(deleteTarget?.amount) }} loan to
            <strong>{{ deleteTarget?.party_name }}</strong>? This cannot be
            undone.
          </div>
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            size="large"
            variant="outlined"
            @click="showDeleteConfirm = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :loading="deleting"
            size="large"
            variant="flat"
            @click="confirmDelete"
          >
            <v-icon start>mdi-delete</v-icon>
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

const store = useStore();

const loading = ref(false);
const saving = ref(false);
const recordingPayment = ref(false);
const deleting = ref(false);

const loans = ref([]);
const totalOutstanding = ref(0);
const staffList = ref([]);
const borrowers = ref([]);

const search = ref("");
const type = ref("");
const onlyOutstanding = ref(true);

const today = new Date().toISOString().split("T")[0];
const paymentMethods = ["CASH", "SALARY_DEDUCTION", "MOBILE", "BANK"];

const showAddDialog = ref(false);
const newLoan = reactive({
  type: "staff",
  staff_id: null,
  borrowerSelection: null,
  borrower_phone: "",
  amount: "",
  loan_date: today,
  reason: "",
});

// borrowerSelection is normalized (see onBorrowerChange) to either a
// trimmed string (a typed name with no matching existing borrower) or a
// {id, name} object (an existing borrower picked from the list) — but
// Vuetify can still hand back {id: null, name: "..."} for typed text that
// never got explicitly selected, so "new" means "no id", not "is a string".
const isNewBorrower = computed(() => {
  const b = newLoan.borrowerSelection;
  if (typeof b === "string") return b.trim().length > 0;
  if (b && typeof b === "object") return !b.id;
  return false;
});

const canSaveLoan = computed(() => {
  if (!newLoan.amount || Number(newLoan.amount) <= 0) return false;
  if (!newLoan.loan_date) return false;
  if (newLoan.type === "staff") return !!newLoan.staff_id;

  const b = newLoan.borrowerSelection;
  if (typeof b === "string") return b.trim().length > 0;
  if (b && typeof b === "object") return !!(b.id || b.name?.trim());
  return false;
});

const showPaymentDialog = ref(false);
const paymentTarget = ref(null);
const paymentForm = reactive({
  amount: "",
  method: "CASH",
  reference: "",
  repayment_date: today,
});

const showDeleteConfirm = ref(false);
const deleteTarget = ref(null);

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function loadLoans() {
  loading.value = true;
  const params = new URLSearchParams();
  if (search.value) params.append("search", search.value);
  if (type.value) params.append("type", type.value);
  params.append("outstanding", String(onlyOutstanding.value));

  try {
    const res = await fetch(`/loans?${params}`);
    if (!res.ok) throw new Error("Failed to load loans");
    const data = await res.json();
    loans.value = data.data || [];
    totalOutstanding.value = data.totalOutstanding || 0;
  } catch (error) {
    store.commit("setMessage", { type: "error", text: "Failed to load loans" });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  search.value = "";
  type.value = "";
  onlyOutstanding.value = true;
  loadLoans();
}

async function loadStaffList() {
  try {
    const res = await fetch("/staffs?limit=1000&status=Active");
    const data = await res.json();
    staffList.value = data.data || [];
  } catch (error) {
    console.error("Failed to load staff:", error);
  }
}

// Vuetify's v-combobox return-object output is inconsistent between a
// typed-but-unselected name and a picked existing item; normalize to
// either a trimmed string (new name) or a plain {id, name} object
// (existing borrower) so downstream logic only ever deals with those two
// shapes. Same pattern as Sales.vue's customer combobox.
function onBorrowerChange(val) {
  if (typeof val === "string") {
    newLoan.borrowerSelection = val.trim() || null;
    return;
  }
  if (val && typeof val === "object") {
    newLoan.borrowerSelection = { id: val.id ?? null, name: val.name ?? "" };
    return;
  }
  newLoan.borrowerSelection = null;
}

async function onBorrowerSearch(value) {
  try {
    const res = await fetch(
      `/loans/borrowers?search=${encodeURIComponent(value || "")}`,
    );
    const data = await res.json();
    borrowers.value = data.data || [];
  } catch (error) {
    console.error("Failed to search borrowers:", error);
  }
}

function openAddDialog() {
  newLoan.type = "staff";
  newLoan.staff_id = null;
  newLoan.borrowerSelection = null;
  newLoan.borrower_phone = "";
  newLoan.amount = "";
  newLoan.loan_date = today;
  newLoan.reason = "";
  showAddDialog.value = true;
}

async function submitLoan() {
  if (!canSaveLoan.value) return;
  saving.value = true;

  const payload = {
    amount: Number(newLoan.amount),
    loan_date: newLoan.loan_date,
    reason: newLoan.reason || null,
  };

  if (newLoan.type === "staff") {
    payload.staff_id = newLoan.staff_id;
  } else {
    const b = newLoan.borrowerSelection;
    const typedName = typeof b === "string" ? b.trim() : b?.name?.trim();
    const existingId = typeof b === "object" ? b?.id : null;

    if (existingId) {
      payload.borrower_id = existingId;
    } else {
      payload.borrower_name = typedName;
      payload.borrower_phone = newLoan.borrower_phone || null;
    }
  }

  try {
    const res = await fetch("/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Failed to save loan");

    store.commit("setMessage", { type: "success", text: "Loan recorded" });
    showAddDialog.value = false;
    loadLoans();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to save loan",
    });
  } finally {
    saving.value = false;
  }
}

function openPaymentDialog(loan) {
  paymentTarget.value = loan;
  paymentForm.amount = String(loan.balance);
  paymentForm.method = loan.type === "staff" ? "SALARY_DEDUCTION" : "CASH";
  paymentForm.reference = "";
  paymentForm.repayment_date = today;
  showPaymentDialog.value = true;
}

async function submitPayment() {
  if (!paymentTarget.value || !paymentForm.amount) return;
  recordingPayment.value = true;
  try {
    const res = await fetch(`/loans/${paymentTarget.value.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(paymentForm.amount),
        method: paymentForm.method || null,
        reference: paymentForm.reference || null,
        repayment_date: paymentForm.repayment_date || today,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Failed to record repayment");

    store.commit("setMessage", { type: "success", text: "Repayment recorded" });
    showPaymentDialog.value = false;
    loadLoans();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to record repayment",
    });
  } finally {
    recordingPayment.value = false;
  }
}

function openDeleteDialog(loan) {
  deleteTarget.value = loan;
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    const res = await fetch(`/loans/${deleteTarget.value.id}`, {
      method: "DELETE",
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Failed to delete loan");

    store.commit("setMessage", { type: "success", text: "Loan deleted" });
    showDeleteConfirm.value = false;
    loadLoans();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to delete loan",
    });
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  loadLoans();
  loadStaffList();
  onBorrowerSearch("");
});
</script>
