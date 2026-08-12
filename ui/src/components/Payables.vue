<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="6">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-cash-minus</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">Payables</h1>
                <p class="text-body-1 text-grey mt-1">
                  Money the business owes — to staff (e.g. unpaid wages) and
                  to people outside the company (e.g. suppliers)
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="6">
            <v-chip class="mr-3" color="error" size="large" variant="flat">
              Outstanding: {{ money(totalOutstanding) }}
            </v-chip>
            <v-btn
              v-if="$store.getters.hasTask('can_add_payable')"
              color="primary"
              size="large"
              @click="openAddDialog"
            >
              <v-icon start>mdi-plus</v-icon>
              New Payable
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
                { title: 'All payables (incl. settled)', value: false },
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
              @click="loadPayables"
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
            <th class="text-left font-weight-bold text-grey">OWED TO</th>
            <th class="text-center font-weight-bold text-grey">TYPE</th>
            <th class="text-left font-weight-bold text-grey">DATE</th>
            <th class="text-right font-weight-bold text-grey">AMOUNT</th>
            <th class="text-right font-weight-bold text-grey">PAID</th>
            <th class="text-right font-weight-bold text-grey">BALANCE</th>
            <th class="text-right font-weight-bold text-grey">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in payables" :key="p.id">
            <td class="text-left">
              <div class="font-weight-medium">{{ p.party_name }}</div>
              <div v-if="p.reason" class="text-caption text-grey">
                {{ p.reason }}
              </div>
            </td>
            <td class="text-center">
              <v-chip
                :color="p.type === 'staff' ? 'primary' : 'orange'"
                size="small"
                variant="flat"
              >
                {{ p.type === "staff" ? "Staff" : "External" }}
              </v-chip>
            </td>
            <td class="text-left">{{ formatDate(p.payable_date) }}</td>
            <td class="text-right">{{ money(p.amount) }}</td>
            <td class="text-right">{{ money(p.paid) }}</td>
            <td class="text-right">
              <v-chip
                :color="Number(p.balance) > 0 ? 'error' : 'success'"
                size="small"
                variant="flat"
              >
                {{ money(p.balance) }}
              </v-chip>
            </td>
            <td class="text-right">
              <v-btn
                v-if="
                  Number(p.balance) > 0 &&
                  $store.getters.hasTask('can_add_payable_payment')
                "
                class="mr-1"
                color="primary"
                size="small"
                variant="tonal"
                @click="openPaymentDialog(p)"
              >
                Record Payment
              </v-btn>
              <v-btn
                v-if="
                  Number(p.paid) === 0 &&
                  $store.getters.hasTask('can_delete_payable')
                "
                color="error"
                icon
                size="small"
                variant="text"
                @click="openDeleteDialog(p)"
              >
                <v-icon>mdi-delete-outline</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="!loading && payables.length === 0" class="text-center py-12">
        <v-icon class="mb-4" color="grey" size="64">mdi-check-circle</v-icon>
        <div class="text-h6 text-grey mb-2">No payables found</div>
        <div class="text-body-1 text-grey">
          {{
            search || type
              ? "No payables match this search."
              : "Nothing outstanding right now."
          }}
        </div>
      </div>
    </v-card>

    <!-- NEW PAYABLE DIALOG -->
    <v-dialog v-model="showAddDialog" max-width="600">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-cash-minus</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            New Payable
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showAddDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-btn-toggle
            v-model="newPayable.type"
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
            v-if="newPayable.type === 'staff'"
            v-model="newPayable.staff_id"
            autocomplete="off"
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
              autocomplete="off"
              clearable
              density="comfortable"
              hide-no-data
              item-title="name"
              item-value="id"
              :items="creditors"
              label="Creditor (existing or type a new name)"
              :model-value="newPayable.creditorSelection"
              prepend-inner-icon="mdi-account"
              return-object
              variant="outlined"
              @update:model-value="onCreditorChange"
              @update:search="onCreditorSearch"
            />
            <v-text-field
              v-if="isNewCreditor"
              v-model="newPayable.creditor_phone"
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
            v-model="newPayable.amount"
            autocomplete="off"
            autocorrect="off"
            density="comfortable"
            label="Amount"
            prepend-inner-icon="mdi-cash"
            spellcheck="false"
            type="number"
            variant="outlined"
          />
          <DateField v-model="newPayable.payable_date" label="Date" />
          <v-textarea
            v-model="newPayable.reason"
            autocomplete="off"
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
            :disabled="!canSavePayable"
            :loading="saving"
            size="large"
            variant="flat"
            @click="submitPayable"
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
            Record Payment
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showPaymentDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-6">
          <div class="text-body-1 mb-4">
            We owe <strong>{{ paymentTarget?.party_name }}</strong>
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
          <DateField v-model="paymentForm.payment_date" label="Date" />
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
          <div class="text-h5 font-weight-bold mb-2">Delete Payable?</div>
          <div class="text-body-1 text-grey mb-4">
            Delete the {{ money(deleteTarget?.amount) }} payable owed to
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
import { formatDMY, toISODateOnly } from "@/utils/date.js";
import DateField from "@/components/shared/DateField.vue";

const store = useStore();

const loading = ref(false);
const saving = ref(false);
const recordingPayment = ref(false);
const deleting = ref(false);

const payables = ref([]);
const totalOutstanding = ref(0);
const staffList = ref([]);
const creditors = ref([]);

const search = ref("");
const type = ref("");
const onlyOutstanding = ref(true);

const todayDisplay = formatDMY(new Date());
const paymentMethods = ["CASH", "SALARY_DEDUCTION", "MOBILE", "BANK"];

const showAddDialog = ref(false);
const newPayable = reactive({
  type: "staff",
  staff_id: null,
  creditorSelection: null,
  creditor_phone: "",
  amount: "",
  payable_date: todayDisplay,
  reason: "",
});

// creditorSelection is normalized (see onCreditorChange) to either a
// trimmed string (a typed name with no matching existing creditor) or a
// {id, name} object (an existing creditor picked from the list) — but
// Vuetify can still hand back {id: null, name: "..."} for typed text that
// never got explicitly selected, so "new" means "no id", not "is a string".
const isNewCreditor = computed(() => {
  const c = newPayable.creditorSelection;
  if (typeof c === "string") return c.trim().length > 0;
  if (c && typeof c === "object") return !c.id;
  return false;
});

const canSavePayable = computed(() => {
  if (!newPayable.amount || Number(newPayable.amount) <= 0) return false;
  if (!newPayable.payable_date) return false;
  if (newPayable.type === "staff") return !!newPayable.staff_id;

  const c = newPayable.creditorSelection;
  if (typeof c === "string") return c.trim().length > 0;
  if (c && typeof c === "object") return !!(c.id || c.name?.trim());
  return false;
});

const showPaymentDialog = ref(false);
const paymentTarget = ref(null);
const paymentForm = reactive({
  amount: "",
  method: "CASH",
  reference: "",
  payment_date: todayDisplay,
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
  return formatDMY(dateString);
}

async function loadPayables() {
  loading.value = true;
  const params = new URLSearchParams();
  if (search.value) params.append("search", search.value);
  if (type.value) params.append("type", type.value);
  params.append("outstanding", String(onlyOutstanding.value));

  try {
    const res = await fetch(`/payables?${params}`);
    if (!res.ok) throw new Error("Failed to load payables");
    const data = await res.json();
    payables.value = data.data || [];
    totalOutstanding.value = data.totalOutstanding || 0;
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load payables",
    });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  search.value = "";
  type.value = "";
  onlyOutstanding.value = true;
  loadPayables();
}

async function loadStaffList() {
  try {
    const res = await fetch("/staffs/picker");
    const data = await res.json();
    staffList.value = data.data || [];
  } catch (error) {
    console.error("Failed to load staff:", error);
  }
}

// Vuetify's v-combobox return-object output is inconsistent between a
// typed-but-unselected name and a picked existing item; normalize to
// either a trimmed string (new name) or a plain {id, name} object
// (existing creditor) so downstream logic only ever deals with those two
// shapes. Same pattern as Loans.vue's borrower combobox.
function onCreditorChange(val) {
  if (typeof val === "string") {
    newPayable.creditorSelection = val.trim() || null;
    return;
  }
  if (val && typeof val === "object") {
    newPayable.creditorSelection = { id: val.id ?? null, name: val.name ?? "" };
    return;
  }
  newPayable.creditorSelection = null;
}

async function onCreditorSearch(value) {
  try {
    const res = await fetch(
      `/payables/creditors?search=${encodeURIComponent(value || "")}`,
    );
    const data = await res.json();
    creditors.value = data.data || [];
  } catch (error) {
    console.error("Failed to search creditors:", error);
  }
}

function openAddDialog() {
  newPayable.type = "staff";
  newPayable.staff_id = null;
  newPayable.creditorSelection = null;
  newPayable.creditor_phone = "";
  newPayable.amount = "";
  newPayable.payable_date = todayDisplay;
  newPayable.reason = "";
  showAddDialog.value = true;
}

async function submitPayable() {
  if (!canSavePayable.value) return;
  saving.value = true;

  const payload = {
    amount: Number(newPayable.amount),
    payable_date: toISODateOnly(newPayable.payable_date),
    reason: newPayable.reason || null,
  };

  if (newPayable.type === "staff") {
    payload.staff_id = newPayable.staff_id;
  } else {
    const c = newPayable.creditorSelection;
    const typedName = typeof c === "string" ? c.trim() : c?.name?.trim();
    const existingId = typeof c === "object" ? c?.id : null;

    if (existingId) {
      payload.creditor_id = existingId;
    } else {
      payload.creditor_name = typedName;
      payload.creditor_phone = newPayable.creditor_phone || null;
    }
  }

  try {
    const res = await fetch("/payables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Failed to save payable");

    store.commit("setMessage", { type: "success", text: "Payable recorded" });
    showAddDialog.value = false;
    loadPayables();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to save payable",
    });
  } finally {
    saving.value = false;
  }
}

function openPaymentDialog(payable) {
  paymentTarget.value = payable;
  paymentForm.amount = String(payable.balance);
  paymentForm.method = payable.type === "staff" ? "SALARY_DEDUCTION" : "CASH";
  paymentForm.reference = "";
  paymentForm.payment_date = todayDisplay;
  showPaymentDialog.value = true;
}

async function submitPayment() {
  if (!paymentTarget.value || !paymentForm.amount) return;
  recordingPayment.value = true;
  try {
    const res = await fetch(`/payables/${paymentTarget.value.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(paymentForm.amount),
        method: paymentForm.method || null,
        reference: paymentForm.reference || null,
        payment_date:
          toISODateOnly(paymentForm.payment_date) ||
          new Date().toISOString().split("T")[0],
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Failed to record payment");

    store.commit("setMessage", { type: "success", text: "Payment recorded" });
    showPaymentDialog.value = false;
    loadPayables();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to record payment",
    });
  } finally {
    recordingPayment.value = false;
  }
}

function openDeleteDialog(payable) {
  deleteTarget.value = payable;
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    const res = await fetch(`/payables/${deleteTarget.value.id}`, {
      method: "DELETE",
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "Failed to delete payable");

    store.commit("setMessage", { type: "success", text: "Payable deleted" });
    showDeleteConfirm.value = false;
    loadPayables();
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: error.message || "Failed to delete payable",
    });
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  loadPayables();
  loadStaffList();
  onCreditorSearch("");
});
</script>
