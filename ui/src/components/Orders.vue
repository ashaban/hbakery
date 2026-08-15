<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="7">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-clipboard-list</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Customer Orders
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Orders placed by customers from the mobile app. Schedule
                  the day each order goes out, and exactly what goes with it.
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="5">
            <v-chip class="mr-3" color="orange" size="large" variant="flat">
              {{ pendingCount }} awaiting scheduling
            </v-chip>
            <v-btn color="primary" variant="outlined" @click="openRunSheet">
              <v-icon start>mdi-truck-delivery</v-icon>
              Day's Deliveries
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
              label="Customer name or phone"
              prepend-inner-icon="mdi-magnify"
              spellcheck="false"
              variant="outlined"
              @keyup.enter="loadOrders"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="status"
              clearable
              density="comfortable"
              :items="statusFilterOptions"
              label="Status"
              prepend-inner-icon="mdi-filter"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <DateField v-model="fromDate" clearable label="Ordered from" />
          </v-col>
          <v-col class="d-flex" cols="12" sm="3">
            <v-btn
              class="mr-2"
              color="primary"
              :loading="loading"
              variant="flat"
              @click="loadOrders"
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

      <div v-if="!loading && orders.length === 0" class="pa-12 text-center">
        <v-icon class="mb-4" color="grey-lighten-1" size="64">
          mdi-clipboard-text-off
        </v-icon>
        <div class="text-h6 text-grey">No orders yet</div>
        <div class="text-body-2 text-grey">
          Orders placed in the customer app will appear here.
        </div>
      </div>

      <v-expansion-panels v-else v-model="openPanel" variant="accordion">
        <v-expansion-panel v-for="order in orders" :key="order.id">
          <v-expansion-panel-title>
            <v-row align="center" dense no-gutters>
              <v-col cols="12" md="3">
                <div class="font-weight-bold">{{ order.customer_name }}</div>
                <div class="text-caption text-grey">
                  {{ order.customer_phone }}
                </div>
              </v-col>
              <v-col cols="12" md="3">
                <div class="text-body-2">
                  {{ order.customer_district }}, {{ order.customer_town }}
                </div>
                <div class="text-caption text-grey">
                  {{ order.customer_region }}
                </div>
              </v-col>
              <v-col cols="6" md="2">
                <div class="text-caption text-grey">ORDERED</div>
                <div class="text-body-2">
                  {{ formatDate(order.order_date) }}
                </div>
              </v-col>
              <v-col cols="6" md="2">
                <div class="text-caption text-grey">TOTAL</div>
                <div class="text-body-2 font-weight-bold">
                  {{ money(order.total) }}
                </div>
              </v-col>
              <v-col class="text-right pr-4" cols="12" md="2">
                <v-chip
                  :color="statusColor(order.status)"
                  size="small"
                  variant="flat"
                >
                  {{ statusLabel(order.status) }}
                </v-chip>
              </v-col>
            </v-row>
          </v-expansion-panel-title>

          <v-expansion-panel-text>
            <!-- Where to take it. The landmark is the whole reason
                 registration asks for one, so it gets its own line. -->
            <v-alert
              class="mb-4"
              color="blue-grey"
              density="compact"
              variant="tonal"
            >
              <div class="text-body-2">
                <v-icon size="18" start>mdi-map-marker</v-icon>
                <strong>
                  {{ order.customer_town }}, {{ order.customer_district }},
                  {{ order.customer_region }}
                </strong>
              </div>
              <div v-if="order.customer_landmark" class="text-body-2 mt-1">
                <v-icon size="18" start>mdi-sign-direction</v-icon>
                {{ order.customer_landmark }}
              </div>
            </v-alert>

            <v-alert
              v-if="order.notes"
              class="mb-4"
              density="compact"
              type="info"
              variant="tonal"
            >
              {{ order.notes }}
            </v-alert>

            <!-- WHAT WAS ORDERED -->
            <div class="text-subtitle-2 font-weight-bold mb-2">
              Items ordered
            </div>
            <v-table class="mb-6" density="compact">
              <thead>
                <tr class="bg-grey-lighten-4">
                  <th class="text-left">PRODUCT</th>
                  <th class="text-right">ORDERED</th>
                  <th class="text-right">SCHEDULED</th>
                  <th class="text-right">REMAINING</th>
                  <th class="text-right">UNIT PRICE</th>
                  <th class="text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in order.items" :key="item.id">
                  <td>{{ item.product_name }}</td>
                  <td class="text-right">
                    {{ qty(item.quantity) }} {{ item.unit }}
                  </td>
                  <td class="text-right">{{ qty(item.scheduled_quantity) }}</td>
                  <td class="text-right">
                    <span
                      :class="
                        remaining(item) > 0
                          ? 'text-orange font-weight-bold'
                          : 'text-grey'
                      "
                    >
                      {{ qty(remaining(item)) }}
                    </span>
                  </td>
                  <td class="text-right">{{ money(item.unit_price) }}</td>
                  <td class="text-right">{{ money(item.line_total) }}</td>
                </tr>
              </tbody>
            </v-table>

            <!-- SCHEDULED DELIVERIES -->
            <div class="d-flex align-center mb-2">
              <div class="text-subtitle-2 font-weight-bold">
                Scheduled deliveries
              </div>
              <v-spacer />
              <v-btn
                v-if="
                  $store.getters.hasTask('can_schedule_order_delivery') &&
                    order.status !== 'CANCELLED' &&
                    hasUnscheduled(order)
                "
                color="primary"
                size="small"
                variant="flat"
                @click="openScheduleDialog(order)"
              >
                <v-icon start>mdi-calendar-plus</v-icon>
                Schedule a delivery
              </v-btn>
            </div>

            <div
              v-if="order.deliveries.length === 0"
              class="text-body-2 text-grey mb-4"
            >
              Nothing scheduled yet.
            </div>

            <v-card
              v-for="delivery in order.deliveries"
              :key="delivery.id"
              class="mb-3"
              variant="outlined"
            >
              <v-card-text class="pa-4">
                <div class="d-flex align-center mb-2">
                  <v-icon
                    :color="delivery.delivered_at ? 'success' : 'primary'"
                    start
                  >
                    {{
                      delivery.delivered_at
                        ? "mdi-check-circle"
                        : "mdi-calendar-clock"
                    }}
                  </v-icon>
                  <span class="font-weight-bold">
                    {{ formatDate(delivery.delivery_date) }}
                  </span>
                  <v-chip
                    class="ml-3"
                    :color="delivery.delivered_at ? 'success' : 'primary'"
                    size="x-small"
                    variant="flat"
                  >
                    {{ delivery.delivered_at ? "Delivered" : "Scheduled" }}
                  </v-chip>
                  <v-spacer />
                  <template
                    v-if="$store.getters.hasTask('can_schedule_order_delivery')"
                  >
                    <v-btn
                      class="mr-2"
                      :color="delivery.delivered_at ? 'grey' : 'success'"
                      size="small"
                      variant="outlined"
                      @click="toggleDelivered(delivery)"
                    >
                      <v-icon start>
                        {{
                          delivery.delivered_at ? "mdi-undo" : "mdi-check"
                        }}
                      </v-icon>
                      {{
                        delivery.delivered_at
                          ? "Undo delivered"
                          : "Mark delivered"
                      }}
                    </v-btn>
                    <v-btn
                      v-if="!delivery.delivered_at"
                      color="error"
                      icon
                      size="small"
                      variant="text"
                      @click="confirmRemoveDelivery(order, delivery)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </template>
                </div>

                <div class="text-body-2">
                  <span
                    v-for="(item, index) in delivery.items"
                    :key="item.id"
                    class="mr-3"
                  >
                    {{ item.product_name }}:
                    <strong>{{ qty(item.quantity) }}</strong> {{ item.unit
                    }}<span v-if="index < delivery.items.length - 1">,</span>
                  </span>
                </div>
                <div v-if="delivery.notes" class="text-caption text-grey mt-1">
                  {{ delivery.notes }}
                </div>
              </v-card-text>
            </v-card>

            <div class="mt-4">
              <v-btn
                v-if="
                  $store.getters.hasTask('can_cancel_order') &&
                    order.status !== 'CANCELLED' &&
                    order.status !== 'DELIVERED'
                "
                color="error"
                size="small"
                variant="outlined"
                @click="confirmCancel(order)"
              >
                <v-icon start>mdi-close-circle</v-icon>
                Cancel order
              </v-btn>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-divider v-if="totalPages > 1" />
      <v-pagination
        v-if="totalPages > 1"
        v-model="page"
        class="my-4"
        :length="totalPages"
        @update:model-value="loadOrders"
      />
    </v-card>

    <!-- SCHEDULE DIALOG -->
    <v-dialog v-model="showScheduleDialog" max-width="640">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-calendar-plus</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Schedule a delivery
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showScheduleDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <div class="text-body-2 text-grey mb-4">
            Choose the day this goes out and how much of each item goes with
            it. Leave a line at 0 to send it on a different day instead.
          </div>

          <DateField
            v-model="scheduleForm.delivery_date"
            label="Delivery date"
            :min-date="today"
          />

          <v-table class="mb-4" density="compact">
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left">PRODUCT</th>
                <th class="text-right">REMAINING</th>
                <th class="text-right" style="width: 140px">THIS DELIVERY</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in scheduleLines" :key="line.order_item_id">
                <td>{{ line.product_name }}</td>
                <td class="text-right">
                  {{ qty(line.remaining) }} {{ line.unit }}
                </td>
                <td>
                  <v-text-field
                    v-model="line.quantity"
                    autocomplete="off"
                    density="compact"
                    hide-details
                    :max="line.remaining"
                    min="0"
                    reverse
                    type="number"
                    variant="outlined"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>

          <v-text-field
            v-model="scheduleForm.notes"
            autocomplete="off"
            autocorrect="off"
            density="comfortable"
            label="Note for this delivery (optional)"
            spellcheck="false"
            variant="outlined"
          />

          <v-alert
            v-if="scheduleError"
            class="mt-2"
            density="compact"
            type="error"
            variant="tonal"
          >
            {{ scheduleError }}
          </v-alert>
        </v-card-text>

        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn
            size="large"
            variant="outlined"
            @click="showScheduleDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :disabled="!canSchedule"
            :loading="scheduling"
            size="large"
            variant="flat"
            @click="submitSchedule"
          >
            <v-icon start>mdi-check</v-icon>
            Confirm delivery
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- RUN SHEET DIALOG -->
    <v-dialog v-model="showRunSheet" max-width="760">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-truck-delivery</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            Deliveries for a day
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showRunSheet = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <DateField
            v-model="runSheetDate"
            label="Delivery date"
            @update:model-value="loadRunSheet"
          />

          <div
            v-if="!runSheetLoading && runSheet.length === 0"
            class="text-body-2 text-grey text-center py-6"
          >
            Nothing scheduled for that day.
          </div>

          <v-card
            v-for="row in runSheet"
            :key="row.id"
            class="mb-3"
            variant="outlined"
          >
            <v-card-text class="pa-4">
              <div class="d-flex align-center">
                <div>
                  <div class="font-weight-bold">{{ row.customer_name }}</div>
                  <div class="text-caption text-grey">
                    {{ row.customer_phone }}
                  </div>
                </div>
                <v-spacer />
                <v-chip
                  :color="row.delivered_at ? 'success' : 'primary'"
                  size="x-small"
                  variant="flat"
                >
                  {{ row.delivered_at ? "Delivered" : "Scheduled" }}
                </v-chip>
              </div>
              <div class="text-body-2 mt-2">
                <v-icon size="18" start>mdi-map-marker</v-icon>
                {{ row.customer_town }}, {{ row.customer_district }},
                {{ row.customer_region }}
              </div>
              <div v-if="row.customer_landmark" class="text-body-2">
                <v-icon size="18" start>mdi-sign-direction</v-icon>
                {{ row.customer_landmark }}
              </div>
              <div class="text-body-2 mt-2">
                <span v-for="(item, i) in row.items" :key="i" class="mr-3">
                  {{ item.product_name }}:
                  <strong>{{ qty(item.quantity) }}</strong> {{ item.unit }}
                </span>
              </div>
            </v-card-text>
          </v-card>
        </v-card-text>
      </v-card>
    </v-dialog>

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
            :loading="confirming"
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
  import { computed, onMounted, reactive, ref } from "vue";
  import { useStore } from "vuex";
  import { formatDMY, toISODateOnly } from "@/utils/date.js";
  import DateField from "@/components/shared/DateField.vue";

  const store = useStore();

  const loading = ref(false);
  const scheduling = ref(false);
  const confirming = ref(false);
  const runSheetLoading = ref(false);

  const orders = ref([]);
  const page = ref(1);
  const totalPages = ref(1);
  const openPanel = ref(null);

  const search = ref("");
  const status = ref("");
  const fromDate = ref("");

  // A delivery can't be promised for a day already past.
  const today = new Date();

  const statusFilterOptions = [
    { title: "All", value: "" },
    { title: "Awaiting scheduling", value: "PENDING" },
    { title: "Partly scheduled", value: "PARTIALLY_SCHEDULED" },
    { title: "Fully scheduled", value: "SCHEDULED" },
    { title: "Partly delivered", value: "PARTIALLY_DELIVERED" },
    { title: "Delivered", value: "DELIVERED" },
    { title: "Cancelled", value: "CANCELLED" },
  ];

  const STATUS_META = {
    PENDING: { label: "Awaiting scheduling", color: "orange" },
    PARTIALLY_SCHEDULED: { label: "Partly scheduled", color: "amber-darken-2" },
    SCHEDULED: { label: "Scheduled", color: "primary" },
    PARTIALLY_DELIVERED: { label: "Partly delivered", color: "teal" },
    DELIVERED: { label: "Delivered", color: "success" },
    CANCELLED: { label: "Cancelled", color: "grey" },
  };

  const pendingCount = computed(
    () => orders.value.filter(o => o.status === "PENDING").length,
  );

  function statusLabel (value) {
    return STATUS_META[value]?.label || value;
  }

  function statusColor (value) {
    return STATUS_META[value]?.color || "grey";
  }

  function money (value) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Quantities are NUMERIC(14,3) so they arrive as "50.000". Bread is
  // counted in whole loaves, so the trailing zeroes are just noise —
  // but keep decimals if a value genuinely has them.
  function qty (value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : String(n);
  }

  function formatDate (value) {
    return formatDMY(value);
  }

  function remaining (item) {
    return Number(item.quantity) - Number(item.scheduled_quantity);
  }

  function hasUnscheduled (order) {
    return order.items.some(item => remaining(item) > 0);
  }

  async function loadOrders () {
    loading.value = true;
    const params = new URLSearchParams();
    if (search.value) params.append("search", search.value);
    if (status.value) params.append("status", status.value);
    if (fromDate.value) {
      const iso = toISODateOnly(fromDate.value);
      if (iso) params.append("from", iso);
    }
    params.append("page", String(page.value));

    try {
      const res = await fetch(`/orders?${params}`);
      if (!res.ok) throw new Error("Failed to load orders");
      const data = await res.json();
      orders.value = data.data || [];
      totalPages.value = data.totalPages || 1;
    } catch {
      store.commit("setMessage", {
        type: "error",
        text: "Failed to load orders",
      });
    } finally {
      loading.value = false;
    }
  }

  function resetFilters () {
    search.value = "";
    status.value = "";
    fromDate.value = "";
    page.value = 1;
    loadOrders();
  }

  // ── Scheduling ─────────────────────────────────────────────────────
  const showScheduleDialog = ref(false);
  const scheduleTarget = ref(null);
  const scheduleLines = ref([]);
  const scheduleError = ref("");
  const scheduleForm = reactive({ delivery_date: "", notes: "" });

  const canSchedule = computed(() => {
    if (!scheduleForm.delivery_date) return false;
    return scheduleLines.value.some(line => Number(line.quantity) > 0);
  });

  function openScheduleDialog (order) {
    scheduleTarget.value = order;
    scheduleError.value = "";
    scheduleForm.delivery_date = formatDMY(new Date());
    scheduleForm.notes = "";
    // Default each line to everything still outstanding: scheduling the
    // whole remainder in one go is the common case, and trimming a
    // number down is less work than typing every one in.
    scheduleLines.value = order.items
      .filter(item => remaining(item) > 0)
      .map(item => ({
        order_item_id: item.id,
        product_name: item.product_name,
        unit: item.unit,
        remaining: remaining(item),
        quantity: remaining(item),
      }));
    showScheduleDialog.value = true;
  }

  async function submitSchedule () {
    scheduleError.value = "";

    const overLine = scheduleLines.value.find(
      line => Number(line.quantity) > line.remaining,
    );
    if (overLine) {
      scheduleError.value = `Only ${qty(overLine.remaining)} of ${
        overLine.product_name
      } is still unscheduled.`;
      return;
    }

    const items = scheduleLines.value
      .filter(line => Number(line.quantity) > 0)
      .map(line => ({
        order_item_id: line.order_item_id,
        quantity: Number(line.quantity),
      }));

    scheduling.value = true;
    try {
      const res = await fetch(`/orders/${scheduleTarget.value.id}/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_date: toISODateOnly(scheduleForm.delivery_date),
          notes: scheduleForm.notes || null,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        scheduleError.value = data.error || "Failed to schedule delivery";
        return;
      }
      showScheduleDialog.value = false;
      store.commit("setMessage", {
        type: "success",
        text: "Delivery scheduled",
      });
      await loadOrders();
    } catch {
      scheduleError.value = "Failed to schedule delivery";
    } finally {
      scheduling.value = false;
    }
  }

  async function toggleDelivered (delivery) {
    try {
      const res = await fetch(
        `/orders/deliveries/${delivery.id}/delivered`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delivered: !delivery.delivered_at }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadOrders();
    } catch (error) {
      store.commit("setMessage", {
        type: "error",
        text: error.message || "Failed to update delivery",
      });
    }
  }

  // ── Confirm dialog, shared by cancel + remove ──────────────────────
  const showConfirm = ref(false);
  const confirmTitle = ref("");
  const confirmMessage = ref("");
  let confirmAction = null;

  function confirmCancel (order) {
    confirmTitle.value = "Cancel order?";
    confirmMessage.value = `Cancel ${order.customer_name}'s order of ${money(
      order.total,
    )}? Anything already scheduled for it will no longer be delivered.`;
    confirmAction = async () => {
      const res = await fetch(`/orders/${order.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    };
    showConfirm.value = true;
  }

  function confirmRemoveDelivery (order, delivery) {
    confirmTitle.value = "Remove this delivery?";
    confirmMessage.value = `Unschedule the delivery set for ${formatDate(
      delivery.delivery_date,
    )}? Those items go back to being unscheduled on this order.`;
    confirmAction = async () => {
      const res = await fetch(`/orders/deliveries/${delivery.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    };
    showConfirm.value = true;
  }

  async function runConfirmAction () {
    if (!confirmAction) return;
    confirming.value = true;
    try {
      await confirmAction();
      showConfirm.value = false;
      await loadOrders();
    } catch (error) {
      store.commit("setMessage", {
        type: "error",
        text: error.message || "Action failed",
      });
    } finally {
      confirming.value = false;
    }
  }

  // ── Run sheet ──────────────────────────────────────────────────────
  const showRunSheet = ref(false);
  const runSheetDate = ref("");
  const runSheet = ref([]);

  function openRunSheet () {
    runSheetDate.value = formatDMY(new Date());
    showRunSheet.value = true;
    loadRunSheet();
  }

  async function loadRunSheet () {
    const iso = toISODateOnly(runSheetDate.value);
    if (!iso) return;
    runSheetLoading.value = true;
    try {
      const res = await fetch(`/orders/deliveries?date=${iso}`);
      const data = await res.json();
      runSheet.value = data.data || [];
    } catch {
      runSheet.value = [];
    } finally {
      runSheetLoading.value = false;
    }
  }

  onMounted(loadOrders);
</script>
