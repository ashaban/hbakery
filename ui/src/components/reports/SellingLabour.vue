<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <div class="d-flex align-center flex-wrap ga-4">
          <v-avatar color="primary" size="56">
            <v-icon color="white" size="32">mdi-account-cash</v-icon>
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold text-primary">Selling Labour</h1>
            <p class="text-body-1 text-grey mt-1 mb-0">
              What it cost to have someone selling, per outlet per day, and
              what each unit sold carries.
            </p>
          </div>
          <v-spacer />
          <DateField v-model="date" label="Date" style="max-width: 200px" />
          <v-btn color="primary" :loading="loading" size="large" @click="load">
            <v-icon start>mdi-magnify</v-icon>
            Show
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-row v-if="rows.length" class="mb-2" dense>
      <v-col cols="12" sm="4">
        <v-card border class="text-center" variant="outlined">
          <v-card-text>
            <div class="text-h6 font-weight-bold text-green-darken-2">
              {{ money(totals.pool) }}
            </div>
            <div class="text-caption text-grey">Total Selling Labour</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card border class="text-center" variant="outlined">
          <v-card-text>
            <div class="text-h6 font-weight-bold">
              {{ formatNumber(totals.units_sold) }}
            </div>
            <div class="text-caption text-grey">Units Sold</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card border class="text-center" variant="outlined">
          <v-card-text>
            <div class="text-h6 font-weight-bold text-primary">
              {{ costedOutlets }} / {{ rows.length }}
            </div>
            <div class="text-caption text-grey">Outlets With a Figure</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-card class="rounded-lg" elevation="2">
      <v-progress-linear :active="loading" color="primary" height="4" indeterminate />

      <div v-if="!loading && !rows.length" class="pa-12 text-center">
        <v-icon class="mb-4" color="grey-lighten-1" size="64">mdi-store-off</v-icon>
        <div class="text-h6 text-grey">Nothing sold on this date</div>
        <div class="text-body-2 text-grey">Pick another day.</div>
      </div>

      <v-table v-else density="comfortable">
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="text-left">OUTLET</th>
            <th class="text-left">WHO WAS SELLING</th>
            <th class="text-right">THEIR DAY</th>
            <th class="text-right">UNITS SOLD</th>
            <th class="text-right">PER UNIT</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.outlet_id">
            <td>
              <div class="font-weight-medium">{{ r.outlet_name }}</div>
              <v-chip
                :color="r.outlet_type === 'CAR' ? 'blue' : 'teal'"
                size="x-small"
                variant="tonal"
              >{{ r.outlet_type === "CAR" ? "Vehicle" : "Shop" }}</v-chip>
            </td>
            <td>
              <div v-if="r.crew.length" class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="c in r.crew"
                  :key="c.staff_id"
                  size="x-small"
                  variant="outlined"
                >
                  {{ c.name }}
                  <span v-if="c.daily_rate" class="ml-1">
                    {{ money(c.daily_rate) }}
                  </span>
                  <span v-else class="ml-1 text-warning">no rate</span>
                </v-chip>
              </div>
              <span v-else class="text-caption text-grey">—</span>
            </td>
            <td class="text-right">{{ money(r.pool) }}</td>
            <td class="text-right">{{ formatNumber(r.units_sold) }}</td>
            <td class="text-right">
              <span
                v-if="r.per_unit !== null"
                class="font-weight-bold text-green-darken-2"
              >{{ money(r.per_unit) }}</span>
              <!--
                Reported as a reason rather than 0. A zero here would read as
                "selling this cost nothing", when in fact the figure simply
                cannot be worked out yet — and the reason says what to fix.
              -->
              <v-tooltip v-else location="top">
                <template #activator="{ props }">
                  <v-chip
                    v-bind="props"
                    color="warning"
                    size="small"
                    variant="tonal"
                  >Unknown</v-chip>
                </template>
                {{ r.unavailable_reason }}
              </v-tooltip>
            </td>
          </tr>
        </tbody>
      </v-table>

      <v-alert
        v-if="unknownReasons.length"
        class="ma-4"
        density="compact"
        type="warning"
        variant="tonal"
      >
        <div class="font-weight-bold mb-1">
          {{ unknownReasons.length }} outlet(s) have no figure
        </div>
        <div v-for="(u, i) in unknownReasons" :key="i" class="text-body-2">
          <strong>{{ u.outlet_name }}</strong> — {{ u.unavailable_reason }}
        </div>
      </v-alert>
    </v-card>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, ref } from "vue";
  import { useStore } from "vuex";
  import { formatDMY, toISODateOnly } from "@/utils/date.js";
  import DateField from "@/components/shared/DateField.vue";

  const store = useStore();
  const loading = ref(false);
  const date = ref(formatDMY(new Date()));
  const rows = ref([]);
  const totals = ref({ pool: 0, units_sold: 0 });

  const costedOutlets = computed(
    () => rows.value.filter((r) => r.per_unit !== null).length,
  );
  const unknownReasons = computed(() =>
    rows.value.filter((r) => r.per_unit === null),
  );

  function money (v) {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const formatNumber = (v) => Number(v || 0).toLocaleString();

  async function load () {
    loading.value = true;
    try {
      const res = await fetch(
        `/delivery/selling-labour?date=${toISODateOnly(date.value)}`,
      );
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load");
      const body = await res.json();
      rows.value = body.data || [];
      totals.value = body.totals || { pool: 0, units_sold: 0 };
    } catch (e) {
      store.commit("setMessage", { type: "error", text: e.message });
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);
</script>
