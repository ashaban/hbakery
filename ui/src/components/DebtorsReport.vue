<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="8">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-account-cash</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">
                  Debtors
                </h1>
                <p class="text-body-1 text-grey mt-1">
                  Customers who still owe money, and the sale each debt
                  came from
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="4">
            <v-chip color="error" size="large" variant="flat">
              Total Owed: {{ money(totalOutstanding) }}
            </v-chip>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- FILTERS -->
    <v-card class="mb-6" elevation="1">
      <v-card-text class="pa-4">
        <v-row align="center" dense>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="search"
              autocomplete="off"
              autocorrect="off"
              clearable
              density="comfortable"
              inputmode="none"
              label="Search customer name"
              prepend-inner-icon="mdi-magnify"
              spellcheck="false"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select
              v-model="outletId"
              clearable
              density="comfortable"
              item-title="name"
              item-value="id"
              :items="outlets"
              label="Outlet"
              prepend-inner-icon="mdi-store"
              variant="outlined"
            />
          </v-col>
          <v-col class="d-flex" cols="12" sm="4">
            <v-btn
              class="mr-2"
              color="primary"
              :loading="loading"
              variant="flat"
              @click="loadDebtors"
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
            <th class="text-left font-weight-bold text-grey">CUSTOMER</th>
            <th class="text-left font-weight-bold text-grey">SALE</th>
            <th class="text-left font-weight-bold text-grey">OUTLET</th>
            <th class="text-right font-weight-bold text-grey">OWED</th>
            <th class="text-right font-weight-bold text-grey">REPAID</th>
            <th class="text-right font-weight-bold text-grey">BALANCE</th>
            <th class="text-right font-weight-bold text-grey">ACTION</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in debtors" :key="d.id">
            <td class="text-left">
              <div class="font-weight-medium">{{ d.customer_name }}</div>
              <div v-if="d.notes" class="text-caption text-grey">
                {{ d.notes }}
              </div>
            </td>
            <td class="text-left">
              <router-link
                class="text-primary font-weight-medium"
                :to="{ name: 'Sales', query: { openSale: d.sale_id } }"
              >
                #{{ d.sale_id }}
              </router-link>
              <div class="text-caption text-grey">
                {{ formatDate(d.sale_date) }}
              </div>
            </td>
            <td class="text-left">{{ d.outlet_name }}</td>
            <td class="text-right">{{ money(d.amount) }}</td>
            <td class="text-right">{{ money(d.repaid) }}</td>
            <td class="text-right">
              <v-chip color="error" size="small" variant="flat">
                {{ money(d.balance) }}
              </v-chip>
            </td>
            <td class="text-right">
              <v-btn
                color="primary"
                size="small"
                variant="tonal"
                @click="openSale(d.sale_id)"
              >
                <v-icon start>mdi-open-in-new</v-icon>
                Open Sale
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="!loading && debtors.length === 0" class="text-center py-12">
        <v-icon class="mb-4" color="grey" size="64">mdi-check-circle</v-icon>
        <div class="text-h6 text-grey mb-2">No outstanding debts</div>
        <div class="text-body-1 text-grey">
          {{
            search || outletId
              ? "No debtors match this search."
              : "Every named customer debt has been paid off."
          }}
        </div>
      </div>
    </v-card>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";

const store = useStore();
const router = useRouter();

const loading = ref(false);
const debtors = ref([]);
const totalOutstanding = ref(0);
const search = ref("");
const outletId = ref(null);
const outlets = ref([]);

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

function openSale(saleId) {
  router.push({ name: "Sales", query: { openSale: saleId } });
}

async function loadDebtors() {
  loading.value = true;
  const params = new URLSearchParams();
  if (search.value) params.append("search", search.value);
  if (outletId.value) params.append("outlet_id", outletId.value);

  try {
    const res = await fetch(`/sales/debts/outstanding?${params}`);
    if (!res.ok) throw new Error("Failed to load debtors");
    const data = await res.json();
    debtors.value = data.data || [];
    totalOutstanding.value = data.totalOutstanding || 0;
  } catch (error) {
    store.commit("setMessage", {
      type: "error",
      text: "Failed to load debtors report",
    });
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  search.value = "";
  outletId.value = null;
  loadDebtors();
}

async function loadOutlets() {
  try {
    const params = new URLSearchParams({ limit: 1000 });
    if (store.state.auth.outlets.length) {
      store.state.auth.outlets.forEach((outlet) =>
        params.append("id[]", outlet.outlet_id),
      );
    } else {
      params.append("id[]", -1);
    }
    const res = await fetch(`/outlets?${params}`);
    const data = await res.json();
    outlets.value = data.data || [];
  } catch (error) {
    console.error("Failed to load outlets:", error);
  }
}

onMounted(() => {
  loadDebtors();
  loadOutlets();
});
</script>
