<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="8">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-shield-search</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Transfer Integrity Check
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Confirms every transferred item actually moved stock
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="4">
            <v-btn
              color="primary"
              :loading="loading"
              size="large"
              @click="runCheck"
            >
              <v-icon start>mdi-refresh</v-icon>
              Re-check Now
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- RESULT BANNER -->
    <v-alert
      v-if="!loading && checked"
      class="mb-6"
      :color="hasIssues ? 'error' : 'success'"
      :icon="hasIssues ? 'mdi-alert-circle' : 'mdi-check-circle'"
      prominent
      variant="tonal"
    >
      <div class="text-h6 font-weight-bold">
        {{
          hasIssues
            ? `${issues.length} transfer item(s) did not move stock`
            : "All transfers are consistent"
        }}
      </div>
      <div class="text-body-2">
        {{
          hasIssues
            ? "The items below are recorded as transferred, but no matching stock movement was found. Stock will look missing at the destination until this is fixed."
            : "Every transferred item has a matching stock movement at both ends. No action needed."
        }}
      </div>
    </v-alert>

    <!-- ISSUES TABLE -->
    <v-card v-if="hasIssues" elevation="2">
      <v-card-title class="d-flex align-center bg-red-lighten-5">
        <v-icon class="mr-2" color="error">mdi-alert</v-icon>
        Affected Items
        <v-chip class="ml-3" color="error" size="small" variant="flat">
          {{ issues.length }}
        </v-chip>
      </v-card-title>
      <v-table density="comfortable">
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="text-left font-weight-bold text-grey">TRANSFER</th>
            <th class="text-left font-weight-bold text-grey">DATE</th>
            <th class="text-left font-weight-bold text-grey">PRODUCT</th>
            <th class="text-center font-weight-bold text-grey">QTY</th>
            <th class="text-left font-weight-bold text-grey">FROM → TO</th>
            <th class="text-center font-weight-bold text-grey">OUT</th>
            <th class="text-center font-weight-bold text-grey">IN</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in issues" :key="row.item_id">
            <td>
              <router-link
                class="font-weight-medium text-primary"
                :to="{ name: 'StockTransfers' }"
              >
                #{{ row.transfer_id }}
              </router-link>
            </td>
            <td>{{ formatDate(row.transfer_date) }}</td>
            <td>{{ row.product_name }}</td>
            <td class="text-center">{{ row.quantity }}</td>
            <td>
              {{ row.from_outlet_name }}
              <v-icon size="14">mdi-arrow-right</v-icon>
              {{ row.to_outlet_name }}
            </td>
            <td class="text-center">
              <v-chip
                :color="Number(row.out_qty) > 0 ? 'success' : 'error'"
                size="small"
                variant="flat"
              >
                {{ row.out_qty }}
              </v-chip>
            </td>
            <td class="text-center">
              <v-chip
                :color="Number(row.in_qty) > 0 ? 'success' : 'error'"
                size="small"
                variant="flat"
              >
                {{ row.in_qty }}
              </v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- LOADING STATE -->
    <v-card v-if="loading" class="pa-12 text-center" elevation="1">
      <v-progress-circular color="primary" indeterminate size="48" />
      <div class="text-body-1 text-grey mt-4">Checking transfers...</div>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useStore } from "vuex";

const store = useStore();

const loading = ref(false);
const checked = ref(false);
const issues = ref([]);

const hasIssues = computed(() => issues.value.length > 0);

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function runCheck() {
  loading.value = true;
  try {
    const res = await fetch("/stocktransfers/integrity-check");
    if (!res.ok) throw new Error("Failed to run integrity check");
    const data = await res.json();
    issues.value = data.data || [];
    checked.value = true;
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to run transfer integrity check",
    });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  runCheck();
});
</script>
