<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="7">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-cash-multiple</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">Payroll</h1>
                <p class="text-body-1 text-grey mt-1">
                  Generate a monthly payroll from staff salaries and
                  allowances, adjust it, and pay it.
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="5">
            <v-btn
              v-if="$store.getters.hasTask('can_manage_pay_structure')"
              class="mr-2"
              color="primary"
              variant="outlined"
              @click="openStructure"
            >
              <v-icon start>mdi-cog</v-icon>
              Pay Structure
            </v-btn>
            <v-btn
              v-if="$store.getters.hasTask('can_manage_payroll')"
              color="primary"
              @click="openNewPeriod"
            >
              <v-icon start>mdi-plus</v-icon>
              New Period
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- PERIODS -->
    <v-card class="rounded-lg" elevation="2">
      <v-progress-linear
        :active="loading"
        color="primary"
        height="4"
        :indeterminate="loading"
      />

      <div v-if="!loading && periods.length === 0" class="pa-12 text-center">
        <v-icon class="mb-4" color="grey-lighten-1" size="64">
          mdi-cash-remove
        </v-icon>
        <div class="text-h6 text-grey">No payroll periods yet</div>
        <div class="text-body-2 text-grey">
          Create one to run payroll for a month.
        </div>
      </div>

      <v-expansion-panels v-else v-model="openPanel" variant="accordion">
        <v-expansion-panel
          v-for="period in periods"
          :key="period.id"
          @group:selected="({ value }) => value && loadPeriodDetail(period.id)"
        >
          <v-expansion-panel-title>
            <v-row align="center" dense no-gutters>
              <v-col cols="12" md="3">
                <div class="font-weight-bold">{{ period.title }}</div>
                <div class="text-caption text-grey">{{ period.reference_no }}</div>
              </v-col>
              <v-col cols="6" md="2">
                <div class="text-caption text-grey">STAFF</div>
                <div class="text-body-2">{{ period.staff_count }}</div>
              </v-col>
              <v-col cols="6" md="3">
                <div class="text-caption text-grey">NET PAYABLE</div>
                <div class="text-body-2 font-weight-bold">
                  {{ money(period.total_net) }}
                </div>
              </v-col>
              <v-col class="text-right pr-4" cols="12" md="4">
                <v-chip
                  :color="statusColor(period.status)"
                  size="small"
                  variant="flat"
                >
                  {{ period.status }}
                </v-chip>
              </v-col>
            </v-row>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <template v-if="detail && detail.id === period.id">
              <v-alert
                v-if="detail.notes"
                class="mb-4"
                density="compact"
                type="info"
                variant="tonal"
              >
                {{ detail.notes }}
              </v-alert>

              <!-- TOTALS -->
              <v-row class="mb-4" dense>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-grey">GROSS</div>
                  <div class="text-body-1 font-weight-bold">
                    {{ money(detail.total_gross) }}
                  </div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-grey">EMPLOYEE DEDUCTIONS</div>
                  <div class="text-body-1 font-weight-bold text-error">
                    {{
                      money(
                        Number(detail.total_employee_statutory) +
                          Number(detail.total_other_deductions),
                      )
                    }}
                  </div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-grey">EMPLOYER COST (ON TOP)</div>
                  <div class="text-body-1 font-weight-bold">
                    {{ money(detail.total_employer_statutory) }}
                  </div>
                </v-col>
                <v-col cols="6" sm="3">
                  <div class="text-caption text-grey">NET PAYABLE</div>
                  <div class="text-body-1 font-weight-bold text-success">
                    {{ money(detail.total_net) }}
                  </div>
                </v-col>
              </v-row>

              <!-- ACTIONS -->
              <div
                v-if="
                  detail.status === 'DRAFT' &&
                    $store.getters.hasTask('can_manage_payroll')
                "
                class="d-flex flex-wrap ga-2 mb-4"
              >
                <v-btn
                  color="primary"
                  :loading="acting === 'generate'"
                  size="small"
                  variant="flat"
                  @click="confirmGenerate(period)"
                >
                  <v-icon start>mdi-refresh</v-icon>
                  {{ detail.staff_count ? "Regenerate" : "Generate" }}
                </v-btn>
                <v-btn
                  v-if="detail.staff_count"
                  color="success"
                  :loading="acting === 'pay'"
                  size="small"
                  variant="flat"
                  @click="openPayDialog(period)"
                >
                  <v-icon start>mdi-cash-check</v-icon>
                  Pay
                </v-btn>
                <v-btn
                  color="error"
                  :loading="acting === 'cancel'"
                  size="small"
                  variant="outlined"
                  @click="confirmCancel(period)"
                >
                  <v-icon start>mdi-close-circle</v-icon>
                  Cancel
                </v-btn>
                <v-btn
                  v-if="!detail.staff_count"
                  color="error"
                  :loading="acting === 'delete'"
                  size="small"
                  variant="text"
                  @click="confirmDelete(period)"
                >
                  <v-icon start>mdi-delete</v-icon>
                  Delete
                </v-btn>
              </div>

              <div v-if="detail.status === 'PAID'" class="text-body-2 text-grey mb-4">
                <v-icon color="success" size="18" start>mdi-check-circle</v-icon>
                Paid {{ formatDate(detail.paid_at) }}
                <span v-if="detail.payment_method">
                  via {{ detail.payment_method }}
                </span>
                <span v-if="detail.payment_reference">
                  (ref: {{ detail.payment_reference }})
                </span>
              </div>

              <!-- SLIPS -->
              <v-table v-if="detail.slips.length" density="compact">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="text-left">STAFF</th>
                    <th class="text-right">GROSS</th>
                    <th class="text-right">DEDUCTIONS</th>
                    <th class="text-right">NET</th>
                    <th class="text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="slip in detail.slips" :key="slip.id">
                    <td class="text-left">
                      <div class="font-weight-medium">{{ slip.staff_name }}</div>
                      <div class="text-caption text-grey">
                        {{ slip.staff_position }}
                      </div>
                    </td>
                    <td class="text-right">{{ money(slip.gross) }}</td>
                    <td class="text-right">
                      {{
                        money(
                          Number(slip.employee_statutory) +
                            Number(slip.other_deductions),
                        )
                      }}
                    </td>
                    <td class="text-right font-weight-bold">
                      {{ money(slip.net_pay) }}
                    </td>
                    <td class="text-right">
                      <v-btn
                        v-if="
                          detail.status === 'DRAFT' &&
                            $store.getters.hasTask('can_manage_payroll')
                        "
                        size="small"
                        variant="text"
                        @click="openSlipDialog(slip)"
                      >
                        Manage
                      </v-btn>
                      <v-btn
                        size="small"
                        variant="text"
                        @click="printPayslip(slip)"
                      >
                        <v-icon start>mdi-printer</v-icon>
                        Print
                      </v-btn>
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else class="text-body-2 text-grey">
                Not generated yet.
              </div>
            </template>
            <div v-else class="text-center py-6">
              <v-progress-circular color="primary" indeterminate />
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card>

    <!-- NEW PERIOD DIALOG -->
    <v-dialog v-model="showNewPeriod" max-width="480">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-calendar-plus</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            New Payroll Period
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showNewPeriod = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-6">
          <v-select
            v-model="newPeriod.month"
            density="comfortable"
            item-title="label"
            item-value="value"
            :items="MONTHS"
            label="Month"
            variant="outlined"
          />
          <v-text-field
            v-model.number="newPeriod.year"
            density="comfortable"
            label="Year"
            type="number"
            variant="outlined"
          />
          <v-text-field
            v-model="newPeriod.notes"
            density="comfortable"
            label="Note (optional)"
            variant="outlined"
          />
          <v-alert
            v-if="newPeriodError"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ newPeriodError }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="showNewPeriod = false">
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="creatingPeriod"
            size="large"
            variant="flat"
            @click="submitNewPeriod"
          >
            <v-icon start>mdi-check</v-icon>
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- PAY DIALOG -->
    <v-dialog v-model="showPayDialog" max-width="480">
      <v-card class="rounded-lg">
        <v-toolbar color="success" density="comfortable">
          <v-avatar class="mr-3" color="success" size="40">
            <v-icon color="white">mdi-cash-check</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Pay {{ payTarget?.title }}
          </v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pa-6">
          <div class="text-body-1 mb-4">
            This pays <strong>{{ money(detail?.total_net) }}</strong> across
            {{ detail?.staff_count }} staff, and recovers any loan amounts
            set below. This cannot be undone.
          </div>
          <v-select
            v-model="payForm.payment_method"
            density="comfortable"
            :items="['CASH', 'BANK', 'MOBILE']"
            label="Payment method"
            variant="outlined"
          />
          <v-text-field
            v-model="payForm.payment_reference"
            density="comfortable"
            label="Reference (optional)"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="showPayDialog = false">
            Cancel
          </v-btn>
          <v-btn
            color="success"
            :loading="acting === 'pay'"
            size="large"
            variant="flat"
            @click="submitPay"
          >
            <v-icon start>mdi-check</v-icon>
            Confirm Payment
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- SLIP DIALOG -->
    <v-dialog v-model="showSlipDialog" max-width="640" scrollable>
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-account-cash</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ slipDetail?.staff_name }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showSlipDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text v-if="slipDetail" class="pa-6" style="max-height: 70vh">
          <div class="text-subtitle-2 font-weight-bold mb-2">Earnings</div>
          <v-table class="mb-2" density="compact">
            <tbody>
              <tr v-for="e in slipDetail.earnings" :key="e.id">
                <td>{{ e.description }}</td>
                <td class="text-right">{{ money(e.amount) }}</td>
                <td class="text-right" style="width: 40px">
                  <v-btn
                    v-if="e.kind !== 'BASIC'"
                    color="error"
                    icon
                    size="x-small"
                    variant="text"
                    @click="removeEarning(e)"
                  >
                    <v-icon size="16">mdi-close</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <v-row class="mb-4" dense>
            <v-col cols="7">
              <v-text-field
                v-model="newEarning.description"
                density="compact"
                hide-details
                label="Add earning (e.g. bonus)"
                variant="outlined"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-model="newEarning.amount"
                density="compact"
                hide-details
                label="Amount"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col cols="2">
              <v-btn block color="primary" variant="tonal" @click="addEarning">
                Add
              </v-btn>
            </v-col>
          </v-row>

          <div class="text-subtitle-2 font-weight-bold mb-2">Deductions</div>
          <v-table class="mb-2" density="compact">
            <tbody>
              <tr v-for="d in slipDetail.deductions" :key="d.id">
                <td>
                  {{ d.description }}
                  <v-chip class="ml-1" size="x-small" variant="tonal">
                    {{ d.kind }}
                  </v-chip>
                </td>
                <td class="text-right">{{ money(d.amount) }}</td>
                <td class="text-right" style="width: 40px">
                  <v-btn
                    v-if="d.kind === 'ADHOC'"
                    color="error"
                    icon
                    size="x-small"
                    variant="text"
                    @click="removeDeduction(d)"
                  >
                    <v-icon size="16">mdi-close</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <v-row class="mb-4" dense>
            <v-col cols="7">
              <v-text-field
                v-model="newDeduction.description"
                density="compact"
                hide-details
                label="Add deduction (e.g. uniform)"
                variant="outlined"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-model="newDeduction.amount"
                density="compact"
                hide-details
                label="Amount"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col cols="2">
              <v-btn block color="primary" variant="tonal" @click="addDeduction">
                Add
              </v-btn>
            </v-col>
          </v-row>

          <!-- LOAN RECOVERY -->
          <template v-if="staffLoans.length">
            <div class="text-subtitle-2 font-weight-bold mb-2">
              Loan recovery
            </div>
            <v-table density="compact">
              <tbody>
                <tr v-for="loan in staffLoans" :key="loan.loan_id">
                  <td>
                    Outstanding: {{ money(loan.outstanding) }}
                    of {{ money(loan.principal) }}
                  </td>
                  <td style="width: 160px">
                    <v-text-field
                      density="compact"
                      hide-details
                      label="Recover this period"
                      :model-value="loan.recovering_this_period"
                      type="number"
                      variant="outlined"
                      @update:model-value="(v) => setLoanRecovery(loan, v)"
                    />
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <v-alert
            v-if="slipError"
            class="mt-4"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ slipError }}
          </v-alert>

          <v-divider class="my-4" />
          <div class="d-flex align-center">
            <div class="text-subtitle-1">Net pay</div>
            <v-spacer />
            <div class="text-h6 font-weight-bold">
              {{ money(slipDetail.net_pay) }}
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- PAY STRUCTURE DIALOG -->
    <PayStructureDialog v-model="showStructure" />

    <!-- CONFIRM DIALOG -->
    <v-dialog v-model="showConfirm" max-width="500">
      <v-card class="rounded-lg">
        <v-toolbar color="error" density="comfortable">
          <v-avatar class="mr-3" color="error" size="40">
            <v-icon color="white">mdi-alert</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ confirmTitle }}
          </v-toolbar-title>
        </v-toolbar>
        <v-card-text class="pa-6 text-center">
          <div class="text-body-1 text-grey">{{ confirmMessage }}</div>
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="showConfirm = false">
            Back
          </v-btn>
          <v-btn
            color="error"
            :loading="!!acting"
            size="large"
            variant="flat"
            @click="runConfirmAction"
          >
            <v-icon start>mdi-check</v-icon>
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { onMounted, reactive, ref } from "vue";
  import { useStore } from "vuex";
  import { formatDMY } from "@/utils/date.js";
  import PayStructureDialog from "@/components/settings/PayStructureDialog.vue";

  const store = useStore();

  const MONTHS = [
    { value: 1, label: "January" }, { value: 2, label: "February" },
    { value: 3, label: "March" }, { value: 4, label: "April" },
    { value: 5, label: "May" }, { value: 6, label: "June" },
    { value: 7, label: "July" }, { value: 8, label: "August" },
    { value: 9, label: "September" }, { value: 10, label: "October" },
    { value: 11, label: "November" }, { value: 12, label: "December" },
  ];

  const loading = ref(false);
  const periods = ref([]);
  const openPanel = ref(null);
  const detail = ref(null);
  const acting = ref("");

  function money (value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate (value) {
    return formatDMY(value);
  }

  function statusColor (status) {
    return { DRAFT: "orange", PAID: "success", CANCELLED: "grey" }[status] || "grey";
  }

  async function loadPeriods () {
    loading.value = true;
    try {
      const res = await fetch("/payroll/periods");
      if (!res.ok) throw new Error("Failed to load payroll periods");
      const data = await res.json();
      periods.value = data.data || [];
    } catch {
      store.commit("setMessage", { type: "error", text: "Failed to load payroll periods" });
    } finally {
      loading.value = false;
    }
  }

  async function loadPeriodDetail (periodId) {
    detail.value = null;
    try {
      const res = await fetch(`/payroll/periods/${periodId}`);
      if (!res.ok) throw new Error("Failed to load payroll period");
      detail.value = await res.json();
      if (detail.value.status === "DRAFT") await loadLoans(periodId);
    } catch {
      store.commit("setMessage", { type: "error", text: "Failed to load payroll period" });
    }
  }

  async function refreshCurrent () {
    await loadPeriods();
    if (detail.value) await loadPeriodDetail(detail.value.id);
  }

  // ── New period ───────────────────────────────────────────────────
  const showNewPeriod = ref(false);
  const creatingPeriod = ref(false);
  const newPeriodError = ref("");
  const now = new Date();
  const newPeriod = reactive({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    notes: "",
  });

  function openNewPeriod () {
    newPeriodError.value = "";
    newPeriod.year = now.getFullYear();
    newPeriod.month = now.getMonth() + 1;
    newPeriod.notes = "";
    showNewPeriod.value = true;
  }

  async function submitNewPeriod () {
    newPeriodError.value = "";
    creatingPeriod.value = true;
    try {
      const res = await fetch("/payroll/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPeriod),
      });
      const data = await res.json();
      if (!res.ok) {
        newPeriodError.value = data.error || "Failed to create payroll period";
        return;
      }
      showNewPeriod.value = false;
      await loadPeriods();
      store.commit("setMessage", { type: "success", text: "Payroll period created" });
    } catch {
      newPeriodError.value = "Failed to create payroll period";
    } finally {
      creatingPeriod.value = false;
    }
  }

  // ── Generate / Pay / Cancel / Delete ────────────────────────────
  function confirmGenerate (period) {
    confirmTitle.value = detail.value?.staff_count ? "Regenerate payroll?" : "Generate payroll?";
    confirmMessage.value = detail.value?.staff_count
      ? "This rebuilds every payslip from current staff salaries and allowances. Any manual earnings, deductions or loan recoveries added since it was last generated will be discarded."
      : `Build payslips for ${period.title} from every active staff member's salary and standing allowances?`;
    confirmAction = async () => {
      acting.value = "generate";
      const res = await fetch(`/payroll/periods/${period.id}/generate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      store.commit("setMessage", {
        type: "success",
        text: `Payroll generated for ${data.staff_count} staff`,
      });
    };
    showConfirm.value = true;
  }

  const showPayDialog = ref(false);
  const payTarget = ref(null);
  const payForm = reactive({ payment_method: "BANK", payment_reference: "" });

  function openPayDialog (period) {
    payTarget.value = period;
    payForm.payment_method = "BANK";
    payForm.payment_reference = "";
    showPayDialog.value = true;
  }

  async function submitPay () {
    acting.value = "pay";
    try {
      const res = await fetch(`/payroll/periods/${payTarget.value.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showPayDialog.value = false;
      store.commit("setMessage", { type: "success", text: "Payroll paid" });
      await refreshCurrent();
    } catch (error) {
      store.commit("setMessage", { type: "error", text: error.message || "Failed to pay payroll" });
    } finally {
      acting.value = "";
    }
  }

  function confirmCancel (period) {
    confirmTitle.value = "Cancel this payroll period?";
    confirmMessage.value = `Cancel the draft for ${period.title}? It will stay on record as cancelled.`;
    confirmAction = async () => {
      acting.value = "cancel";
      const res = await fetch(`/payroll/periods/${period.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      store.commit("setMessage", { type: "info", text: "Payroll period cancelled" });
    };
    showConfirm.value = true;
  }

  function confirmDelete (period) {
    confirmTitle.value = "Delete this payroll period?";
    confirmMessage.value = `Delete the empty draft for ${period.title}? This cannot be undone.`;
    confirmAction = async () => {
      acting.value = "delete";
      const res = await fetch(`/payroll/periods/${period.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      detail.value = null;
      openPanel.value = null;
      store.commit("setMessage", { type: "info", text: "Payroll period deleted" });
    };
    showConfirm.value = true;
  }

  const showConfirm = ref(false);
  const confirmTitle = ref("");
  const confirmMessage = ref("");
  let confirmAction = null;

  async function runConfirmAction () {
    if (!confirmAction) return;
    try {
      await confirmAction();
      showConfirm.value = false;
      await refreshCurrent();
    } catch (error) {
      store.commit("setMessage", { type: "error", text: error.message || "Action failed" });
    } finally {
      acting.value = "";
    }
  }

  // ── Slip management ─────────────────────────────────────────────
  const showSlipDialog = ref(false);
  const slipDetail = ref(null);
  const slipError = ref("");
  const staffLoans = ref([]);
  const newEarning = reactive({ description: "", amount: "" });
  const newDeduction = reactive({ description: "", amount: "" });

  async function openSlipDialog (slip) {
    slipError.value = "";
    newEarning.description = "";
    newEarning.amount = "";
    newDeduction.description = "";
    newDeduction.amount = "";
    showSlipDialog.value = true;
    await loadSlip(slip.id);
    staffLoans.value = (loansForPeriod.value || []).filter(
      (l) => l.staff_id === slipDetail.value.staff_id,
    );
  }

  async function loadSlip (slipId) {
    const res = await fetch(`/payroll/slips/${slipId}`);
    slipDetail.value = await res.json();
  }

  const loansForPeriod = ref([]);
  async function loadLoans (periodId) {
    const res = await fetch(`/payroll/periods/${periodId}/loans`);
    const data = await res.json();
    loansForPeriod.value = data.data || [];
  }

  async function addEarning () {
    slipError.value = "";
    if (!newEarning.description.trim() || !(Number(newEarning.amount) > 0)) {
      slipError.value = "A description and an amount greater than zero are required";
      return;
    }
    const res = await fetch(`/payroll/slips/${slipDetail.value.id}/earnings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEarning),
    });
    const data = await res.json();
    if (!res.ok) {
      slipError.value = data.error;
      return;
    }
    newEarning.description = "";
    newEarning.amount = "";
    await loadSlip(slipDetail.value.id);
    await refreshCurrent();
  }

  async function removeEarning (earning) {
    await fetch(`/payroll/earnings/${earning.id}`, { method: "DELETE" });
    await loadSlip(slipDetail.value.id);
    await refreshCurrent();
  }

  async function addDeduction () {
    slipError.value = "";
    if (!newDeduction.description.trim() || !(Number(newDeduction.amount) > 0)) {
      slipError.value = "A description and an amount greater than zero are required";
      return;
    }
    const res = await fetch(`/payroll/slips/${slipDetail.value.id}/deductions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDeduction),
    });
    const data = await res.json();
    if (!res.ok) {
      slipError.value = data.error;
      return;
    }
    newDeduction.description = "";
    newDeduction.amount = "";
    await loadSlip(slipDetail.value.id);
    await refreshCurrent();
  }

  async function removeDeduction (deduction) {
    await fetch(`/payroll/deductions/${deduction.id}`, { method: "DELETE" });
    await loadSlip(slipDetail.value.id);
    await refreshCurrent();
  }

  async function setLoanRecovery (loan, amount) {
    slipError.value = "";
    const res = await fetch(
      `/payroll/periods/${detail.value.id}/loans/${loan.loan_id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) || 0 }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      slipError.value = data.error;
      return;
    }
    await loadLoans(detail.value.id);
    staffLoans.value = loansForPeriod.value.filter(
      (l) => l.staff_id === slipDetail.value.staff_id,
    );
    await loadSlip(slipDetail.value.id);
    await refreshCurrent();
  }

  // ── Print payslip ────────────────────────────────────────────────
  async function printPayslip (slip) {
    const res = await fetch(`/payroll/slips/${slip.id}`);
    const s = await res.json();

    const rows = (arr) =>
      arr.map((r) => `<tr><td>${r.description}</td><td style="text-align:right">${money(r.amount)}</td></tr>`).join("");

    const html = `
      <html><head><title>Payslip - ${s.staff_name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #222; }
        h1 { color: #1867C0; font-size: 20px; margin-bottom: 0; }
        .sub { color: #666; margin-top: 4px; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        td, th { padding: 6px 8px; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 16px; }
      </style></head>
      <body>
        <h1>Hanein Bakery — Payslip</h1>
        <div class="sub">${s.period_title} &middot; ${s.staff_name} ${s.staff_position ? `(${s.staff_position})` : ""}</div>
        <h3>Earnings</h3>
        <table>${rows(s.earnings)}</table>
        <h3>Deductions</h3>
        <table>${rows(s.deductions.filter((d) => d.side === "EMPLOYEE"))}</table>
        <table><tr class="total"><td>Net pay</td><td style="text-align:right">TZS ${money(s.net_pay)}</td></tr></table>
      </body></html>
    `;

    const win = window.open("", "_blank", "width=700,height=900");
    if (!win) {
      store.commit("setMessage", { type: "error", text: "Allow pop-ups to print a payslip" });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  // ── Pay structure ────────────────────────────────────────────────
  const showStructure = ref(false);
  function openStructure () {
    showStructure.value = true;
  }

  onMounted(loadPeriods);
</script>
