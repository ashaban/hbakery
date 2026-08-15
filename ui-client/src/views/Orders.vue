<template>
  <div>
    <v-app-bar color="primary" flat>
      <v-app-bar-title class="font-weight-bold">
        {{ $t("orders.title") }}
      </v-app-bar-title>
      <v-btn icon @click="load">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
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
        <template #append>
            <v-btn size="small" variant="text" @click="load">
            {{ $t("common.retry") }}
          </v-btn>
        </template>
      </v-alert>

      <div
        v-if="!loading && !error && orders.length === 0"
        class="text-center py-12 text-medium-emphasis"
      >
        <v-icon size="56">mdi-clipboard-text-off-outline</v-icon>
        <div class="text-h6 mt-3">{{ $t("orders.empty") }}</div>
        <v-btn class="mt-6" color="primary" @click="$router.push('/shop')">
          {{ $t("cart.browse") }}
        </v-btn>
      </div>

      <v-card
        v-for="order in orders"
        :key="order.id"
        class="mb-3"
        variant="outlined"
        @click="$router.push(`/orders/${order.id}`)"
      >
        <v-card-text>
          <div class="d-flex align-center mb-2">
            <div>
              <div class="text-subtitle-1 font-weight-bold">
                {{ $t("orders.orderNumber", { id: order.id }) }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ $t("orders.placedOn", { date: formatDate(order.order_date) }) }}
              </div>
            </div>
            <v-spacer />
            <v-chip
              :color="statusColor(order.status)"
              size="small"
              variant="flat"
            >
              {{ statusLabel(order.status) }}
            </v-chip>
          </div>

          <div class="text-body-2 text-medium-emphasis">
            {{ order.items.map(i => i.product_name).join(", ") }}
          </div>

          <!-- The next promised day is the thing a customer opens this
               screen to find, so it goes on the card, not one tap in. -->
          <div v-if="nextDelivery(order)" class="text-body-2 mt-2">
            <v-icon color="primary" size="18" start>mdi-truck-delivery</v-icon>
            {{ $t("orders.arriving") }}
            <strong>{{ formatDate(nextDelivery(order)) }}</strong>
          </div>

          <div class="d-flex align-center mt-3">
            <div class="text-h6 font-weight-bold">{{ money(order.total) }}</div>
            <v-spacer />
            <v-icon color="grey">mdi-chevron-right</v-icon>
          </div>
        </v-card-text>
      </v-card>

      <div style="height: 80px" />
    </v-container>
  </div>
</template>

<script setup>
  import { onMounted, ref } from "vue";
  import { api } from "@/lib/api";
  import { formatDate, money, statusColor, statusLabel } from "@/lib/format";

  const orders = ref([]);
  const loading = ref(false);
  const error = ref("");

  // The soonest scheduled day that hasn't been delivered yet.
  function nextDelivery (order) {
    const upcoming = (order.deliveries || [])
      .map(d => d.delivery_date)
      .sort();
    return upcoming[0] || null;
  }

  async function load () {
    loading.value = true;
    error.value = "";
    try {
      const data = await api("/shop/orders");
      orders.value = data.data;
    } catch (error_) {
      error.value = error_.message;
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);
</script>
