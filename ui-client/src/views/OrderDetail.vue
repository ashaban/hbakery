<template>
  <div>
    <v-app-bar color="primary" flat>
      <v-btn icon @click="$router.push('/orders')">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <v-app-bar-title class="font-weight-bold">
        {{ $t("orders.detailTitle", { id: $route.params.id }) }}
      </v-app-bar-title>
    </v-app-bar>

    <v-container fluid>
      <v-progress-linear v-if="loading" color="primary" indeterminate />

      <v-alert
        v-if="error"
        class="my-4"
        density="compact"
        type="error"
        variant="tonal"
      >
        {{ error }}
      </v-alert>

      <template v-if="order">
        <div class="d-flex align-center mb-4">
          <v-chip
            :color="statusColor(order.status)"
            size="large"
            variant="flat"
          >
            {{ statusLabel(order.status) }}
          </v-chip>
          <v-spacer />
          <div class="text-caption text-medium-emphasis">
            {{ $t("orders.placedOn", { date: formatDate(order.order_date) }) }}
          </div>
        </div>

        <!-- DELIVERY SCHEDULE -->
        <div class="text-overline text-medium-emphasis">
          {{ $t("orders.delivery") }}
        </div>

        <v-card
          v-if="order.deliveries.length === 0"
          class="mb-4"
          variant="tonal"
        >
          <v-card-text class="text-body-2">
            <v-icon size="18" start>mdi-clock-outline</v-icon>
            {{ $t("orders.awaitingConfirmation") }}
          </v-card-text>
        </v-card>

        <v-card
          v-for="delivery in order.deliveries"
          :key="delivery.id"
          class="mb-3"
          variant="outlined"
        >
          <v-card-text>
            <div class="d-flex align-center mb-2">
              <v-icon color="primary" start>mdi-truck-delivery</v-icon>
              <span class="text-subtitle-1 font-weight-bold">
                {{ formatDate(delivery.delivery_date) }}
              </span>
            </div>
            <div
              v-for="item in delivery.items"
              :key="item.id"
              class="text-body-2"
            >
              {{ item.product_name }} —
              <strong>{{ qty(item.quantity) }}</strong> {{ item.unit }}
            </div>
            <div v-if="delivery.notes" class="text-caption mt-2">
              {{ delivery.notes }}
            </div>
          </v-card-text>
        </v-card>

        <!-- WHAT WAS ORDERED -->
        <div class="text-overline text-medium-emphasis mt-4">Your order</div>

        <v-card variant="outlined">
          <v-list density="compact">
            <v-list-item v-for="item in order.items" :key="item.id">
              <v-list-item-title class="font-weight-medium">
                {{ item.product_name }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ qty(item.quantity) }} {{ item.unit }} ×
                {{ money(item.unit_price) }}
                <span
                  v-if="Number(item.scheduled_quantity) > 0"
                  class="text-primary"
                >
                  ·
                  {{
                    $t("orders.scheduled", {
                      count: qty(item.scheduled_quantity),
                    })
                  }}
                </span>
              </v-list-item-subtitle>
              <template #append>
                <span class="font-weight-bold">
                  {{ money(item.line_total) }}
                </span>
              </template>
            </v-list-item>
          </v-list>

          <v-divider />

          <v-card-text class="d-flex align-center">
            <div class="text-subtitle-1">{{ $t("common.total") }}</div>
            <v-spacer />
            <div class="text-h6 font-weight-bold">{{ money(order.total) }}</div>
          </v-card-text>
        </v-card>

        <v-card v-if="order.notes" class="mt-3" variant="tonal">
          <v-card-text class="text-body-2">
            <div class="text-caption text-medium-emphasis">
              {{ $t("orders.yourNote") }}
            </div>
            {{ order.notes }}
          </v-card-text>
        </v-card>

        <!-- Cancelling is only offered while nothing has been promised
             yet; after that the bakery may already be baking for it. -->
        <v-btn
          v-if="order.status === 'PENDING'"
          block
          class="mt-6"
          color="error"
          variant="outlined"
          @click="confirmCancel = true"
        >
          {{ $t("orders.cancelOrder") }}
        </v-btn>

        <div style="height: 80px" />
      </template>
    </v-container>

    <v-dialog v-model="confirmCancel" max-width="400">
      <v-card>
        <v-card-title>{{ $t("orders.cancelTitle") }}</v-card-title>
        <v-card-text>
          {{ $t("orders.cancelBody") }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmCancel = false">
            {{ $t("orders.keepOrder") }}
          </v-btn>
          <v-btn color="error" :loading="cancelling" @click="doCancel">
            {{ $t("orders.cancelOrder") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
  import { onMounted, ref } from "vue";
  import { useRoute } from "vue-router";
  import { api } from "@/lib/api";
  import {
    formatDate,
    money,
    qty,
    statusColor,
    statusLabel,
  } from "@/lib/format";
  import { t } from "@/lib/i18n";
  import { notify, notifyError } from "@/lib/toast";

  const route = useRoute();

  const order = ref(null);
  const loading = ref(false);
  const error = ref("");
  const confirmCancel = ref(false);
  const cancelling = ref(false);

  async function load () {
    loading.value = true;
    error.value = "";
    try {
      const data = await api(`/shop/orders/${route.params.id}`);
      order.value = data.data;
    } catch (error_) {
      error.value = error_.message;
    } finally {
      loading.value = false;
    }
  }

  async function doCancel () {
    cancelling.value = true;
    try {
      await api(`/shop/orders/${route.params.id}/cancel`, { method: "POST" });
      confirmCancel.value = false;
      notify(t("orders.cancelled"), "info");
      await load();
    } catch (error_) {
      notifyError(error_);
    } finally {
      cancelling.value = false;
    }
  }

  onMounted(load);
</script>
