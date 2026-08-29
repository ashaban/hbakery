<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <div class="d-flex align-center flex-wrap ga-4">
          <v-avatar color="primary" size="56">
            <v-icon color="white" size="32">mdi-chart-timeline-variant</v-icon>
          </v-avatar>
          <div>
            <h1 class="text-h4 font-weight-bold text-primary">Cost &amp; Margin</h1>
            <p class="text-body-1 text-grey mt-1 mb-0">
              What every unit sold cost to make, move and sell — and what was
              left over.
            </p>
          </div>
          <v-spacer />
          <DateField v-model="from" label="From" style="max-width: 170px" />
          <DateField v-model="to" label="To" style="max-width: 170px" />
          <v-select
            v-model="outletId"
            clearable
            density="comfortable"
            hide-details
            item-title="name"
            item-value="id"
            :items="outlets"
            label="All outlets"
            style="max-width: 200px"
          />
          <v-btn color="primary" :loading="loading" size="large" @click="load">
            <v-icon start>mdi-magnify</v-icon>
            Show
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <v-alert
      v-if="error"
      class="mb-4"
      density="compact"
      type="error"
      variant="tonal"
    >{{ error }}</v-alert>

    <div v-if="report && !report.totals.total_lines" class="text-center py-16">
      <v-icon class="mb-4" color="grey-lighten-1" size="64">mdi-calendar-remove</v-icon>
      <div class="text-h6 text-grey">Nothing was sold or given out in this period</div>
    </div>

    <template v-else-if="report">
      <!-- ── HEADLINE ────────────────────────────────────────────── -->
      <v-row class="mb-2" dense>
        <v-col cols="12" md="3" sm="6">
          <v-card border class="text-center" variant="outlined">
            <v-card-text>
              <div class="text-h6 font-weight-bold text-green-darken-2">
                {{ money(t.revenue) }}
              </div>
              <div class="text-caption text-grey">Revenue</div>
              <div class="text-caption text-grey">
                {{ formatNumber(t.units) }} units
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card border class="text-center" variant="outlined">
            <v-card-text>
              <div class="text-h6 font-weight-bold text-orange-darken-3">
                {{ money(t.cost) }}
              </div>
              <div class="text-caption text-grey">Cost attributed</div>
              <div v-if="t.partial_layers?.length" class="text-caption text-warning">
                At least — some layers are incomplete
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!--
          Margin is stated only over the lines where all five layers were
          known. Anything else is revenue minus a cost that was missing a
          piece, which always flatters.
        -->
        <v-col cols="12" md="3" sm="6">
          <v-card border class="text-center" variant="outlined">
            <v-card-text>
              <div
                v-if="t.complete_lines"
                class="text-h6 font-weight-bold"
                :class="t.margin >= 0 ? 'text-green-darken-2' : 'text-red-darken-2'"
              >
                {{ money(t.margin) }}
              </div>
              <div v-else class="text-h6 font-weight-bold text-grey">—</div>
              <div class="text-caption text-grey">Margin before overheads</div>
              <div class="text-caption text-grey">
                over {{ formatNumber(t.complete_lines) }} fully costed line(s)
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" sm="6">
          <v-card border class="text-center" variant="outlined">
            <v-card-text>
              <div class="text-h6 font-weight-bold text-primary">
                {{ t.margin_pct == null ? "—" : t.margin_pct + "%" }}
              </div>
              <div class="text-caption text-grey">Margin on revenue</div>
              <div
                class="text-caption"
                :class="t.incomplete_lines ? 'text-warning' : 'text-grey'"
              >
                {{ formatNumber(t.incomplete_lines) }} line(s) not fully costed
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── WHAT IS MISSING ─────────────────────────────────────── -->
      <!--
        Deliberately above the numbers, not below. When most lines cannot be
        costed the gaps ARE the report, and a reader who scrolls past them
        will read partial costs as whole ones.
      -->
      <v-card v-if="report.gaps.length" class="mb-4 rounded-lg" elevation="2">
        <v-card-title class="d-flex align-center py-3">
          <v-icon class="mr-2" color="warning">mdi-alert-circle-outline</v-icon>
          <span class="text-subtitle-1 font-weight-bold">
            Why {{ formatNumber(t.incomplete_lines) }} line(s) have no margin
          </span>
        </v-card-title>
        <v-divider />
        <v-table density="compact">
          <tbody>
            <tr v-for="g in report.gaps" :key="g.reason">
              <td style="width: 90px">
                <v-chip color="warning" size="small" variant="tonal">
                  {{ formatNumber(g.lines) }}
                </v-chip>
              </td>
              <td class="text-body-2">{{ g.reason }}</td>
              <td class="text-caption text-grey">{{ fixFor(g.reason) }}</td>
            </tr>
          </tbody>
        </v-table>
      </v-card>

      <!-- ── WHERE THE MONEY WENT ────────────────────────────────── -->
      <v-card class="mb-4 rounded-lg" elevation="2">
        <v-card-title class="d-flex align-center py-3">
          <v-icon class="mr-2" color="primary">mdi-layers-outline</v-icon>
          <span class="text-subtitle-1 font-weight-bold">Cost Layers</span>
          <v-spacer />
          <span class="text-caption text-grey">
            share of the cost that could be attributed
          </span>
        </v-card-title>
        <v-divider />
        <v-card-text>
          <div v-for="l in layers" :key="l.key" class="mb-4">
            <div class="d-flex align-center mb-1">
              <v-icon class="mr-2" :color="l.color" size="18">{{ l.icon }}</v-icon>
              <span class="text-body-2 font-weight-medium">{{ l.label }}</span>
              <v-chip
                v-if="l.amount !== null && l.partial"
                class="ml-2"
                color="warning"
                size="x-small"
                variant="tonal"
              >
                {{ formatNumber(l.known) }} of {{ formatNumber(t.total_lines) }} lines
              </v-chip>
              <v-spacer />
              <span
                class="text-body-2 font-weight-bold"
                :class="l.amount === null ? 'text-grey' : ''"
              >
                {{ l.amount === null ? "Not recorded" : money(l.amount) }}
              </span>
            </div>
            <v-progress-linear
              bg-color="grey-lighten-3"
              :color="l.amount === null ? 'grey-lighten-2' : l.color"
              height="8"
              :model-value="l.share"
              rounded
            />
            <div class="text-caption text-grey mt-1">{{ l.note }}</div>
          </div>
        </v-card-text>
      </v-card>

      <!-- ── SALES vs GIVE-OUTS ──────────────────────────────────── -->
      <v-row v-if="report.by_kind.length > 1" class="mb-2" dense>
        <v-col v-for="k in report.by_kind" :key="k.key" cols="12" md="6">
          <v-card border class="rounded-lg" variant="outlined">
            <v-card-text>
              <div class="d-flex align-center">
                <v-icon
                  class="mr-2"
                  :color="k.key === 'GIVE_OUT' ? 'red-darken-1' : 'green-darken-2'"
                >
                  {{ k.key === "GIVE_OUT" ? "mdi-gift-outline" : "mdi-cash-register" }}
                </v-icon>
                <span class="text-subtitle-2 font-weight-bold">{{ k.label }}</span>
                <v-spacer />
                <span class="text-caption text-grey">
                  {{ formatNumber(k.units) }} units
                </span>
              </div>
              <div class="d-flex justify-space-between mt-3 text-body-2">
                <span>Revenue</span><strong>{{ money(k.revenue) }}</strong>
              </div>
              <div class="d-flex justify-space-between text-body-2">
                <span>Cost attributed</span>
                <strong>{{ k.cost === null ? "—" : money(k.cost) }}</strong>
              </div>
              <!--
                A give-out earns nothing, so its cost IS the loss. Saying so
                plainly is the whole point of separating it from sales.
              -->
              <div
                v-if="k.key === 'GIVE_OUT'"
                class="text-caption text-red-darken-1 mt-2"
              >
                Given away, so every shilling of this is a loss.
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── BREAKDOWNS ──────────────────────────────────────────── -->
      <v-card class="rounded-lg" elevation="2">
        <v-tabs v-model="tab" bg-color="grey-lighten-4" grow>
          <v-tab value="product">By Product</v-tab>
          <v-tab value="outlet">By Outlet</v-tab>
          <v-tab value="day">By Day</v-tab>
        </v-tabs>
        <v-divider />
        <v-window v-model="tab">
          <v-window-item v-for="v in views" :key="v.value" :value="v.value">
            <v-table density="compact">
              <thead>
                <tr class="bg-grey-lighten-4">
                  <th class="text-left">{{ v.heading }}</th>
                  <th class="text-right">UNITS</th>
                  <th class="text-right">REVENUE</th>
                  <th class="text-right">COST</th>
                  <th class="text-right">COST / UNIT</th>
                  <th class="text-right">MARGIN</th>
                  <th class="text-right">MARGIN %</th>
                  <th class="text-left">COSTED</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in v.rows" :key="g.key">
                  <td class="font-weight-medium">
                    {{ v.value === "day" ? formatDMY(g.label) : g.label }}
                  </td>
                  <td class="text-right">{{ formatNumber(g.units) }}</td>
                  <td class="text-right">{{ money(g.revenue) }}</td>
                  <td class="text-right">
                    {{ g.cost === null ? "—" : money(g.cost) }}
                  </td>
                  <td class="text-right">
                    {{ g.cost_per_unit === null ? "—" : money(g.cost_per_unit) }}
                  </td>
                  <td
                    class="text-right font-weight-medium"
                    :class="marginClass(g)"
                  >
                    {{ g.complete_lines ? money(g.margin) : "—" }}
                  </td>
                  <td class="text-right" :class="marginClass(g)">
                    {{ g.margin_pct == null ? "—" : g.margin_pct + "%" }}
                  </td>
                  <td>
                    <!--
                      Every row says how much of itself is real, so a dash in
                      the margin column is never mistaken for a zero margin.
                    -->
                    <v-chip
                      :color="g.fully_costed ? 'green' : 'warning'"
                      size="x-small"
                      variant="tonal"
                    >
                      {{ formatNumber(g.complete_lines) }} /
                      {{ formatNumber(g.total_lines) }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>
        </v-window>
      </v-card>

      <v-alert class="mt-4" density="compact" type="info" variant="tonal">
        {{ report.excludes }}
      </v-alert>
    </template>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, ref } from "vue";
  import { useStore } from "vuex";
  import { formatDMY, toISODateOnly } from "@/utils/date.js";
  import DateField from "@/components/shared/DateField.vue";

  const store = useStore();

  const loading = ref(false);
  const error = ref("");
  const report = ref(null);
  const outlets = ref([]);
  const outletId = ref(null);
  const tab = ref("product");

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const from = ref(formatDMY(startOfMonth));
  const to = ref(formatDMY(new Date()));

  const t = computed(() => report.value?.totals || {});

  function money (v) {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  const formatNumber = (v) => Number(v || 0).toLocaleString();

  function marginClass (g) {
    if (!g.complete_lines) return "text-grey";
    return g.margin >= 0 ? "text-green-darken-2" : "text-red-darken-2";
  }

  const LAYER_META = [
    {
      key: "ingredients",
      label: "Ingredients",
      icon: "mdi-basket",
      color: "brown",
      note: "The FIFO lot prices each production actually drew down.",
    },
    {
      key: "production_labour",
      label: "Production Labour",
      icon: "mdi-account-hard-hat",
      color: "indigo",
      note: "The shift crew's day, or the piece rate for per-quantity work.",
    },
    {
      key: "baking",
      label: "Baking",
      icon: "mdi-stove",
      color: "orange",
      note: "Oven fuel or electricity for the loads that bake ran.",
    },
    {
      key: "delivery",
      label: "Delivery",
      icon: "mdi-truck",
      color: "teal",
      note: "Each transfer's costs, split across the units it carried.",
    },
    {
      key: "selling",
      label: "Selling",
      icon: "mdi-store",
      color: "purple",
      note: "The driver's or shopkeeper's day, over everything sold that day.",
    },
  ];

  /**
   * The layer bars.
   *
   * A share is drawn only against the cost that WAS attributed, so the bars
   * describe the money we can account for rather than implying the rest is
   * nothing.
   */
  const layers = computed(() => {
    const totals = t.value;
    const denom = Number(totals.cost) || 0;
    return LAYER_META.map((m) => {
      const amount = totals[m.key] ?? null;
      const known = totals.layer_lines_known?.[m.key] || 0;
      return {
        ...m,
        amount,
        known,
        partial: known > 0 && known < (totals.total_lines || 0),
        share: amount && denom ? (amount / denom) * 100 : 0,
      };
    });
  });

  const views = computed(() => [
    { value: "product", heading: "PRODUCT", rows: report.value?.by_product || [] },
    { value: "outlet", heading: "OUTLET", rows: report.value?.by_outlet || [] },
    { value: "day", heading: "DAY", rows: report.value?.by_day || [] },
  ]);

  /**
   * What to actually do about a gap.
   *
   * Matched on the reason text the engine returns. A gap nobody knows how to
   * close gets read as a system fault rather than missing setup, and stays
   * open.
   */
  function fixFor (reason) {
    if (reason.startsWith("Baking")) {
      return "Set an oven and bake time on the product, under Settings → Products.";
    }
    if (reason.startsWith("Delivery")) {
      return "Give the transfer a route, or add costs to it under Delivery Routes.";
    }
    if (reason.startsWith("Production labour")) {
      return "Link the production to a shift, or set the product to a per-quantity rate.";
    }
    if (reason.startsWith("Selling")) {
      return "Assign a shopkeeper to the outlet, or name a driver on the transfer.";
    }
    if (reason.startsWith("Ingredients")) {
      return "Record the ingredients the production consumed.";
    }
    return "";
  }

  async function load () {
    loading.value = true;
    error.value = "";
    try {
      const params = new URLSearchParams({
        from: toISODateOnly(from.value),
        to: toISODateOnly(to.value),
      });
      if (outletId.value) params.append("outlet_id", outletId.value);

      const res = await fetch(`/reports/margin?${params}`);
      const body = await res.json();
      // Without this check an error page is rendered as an empty report,
      // which looks like "nothing was sold" rather than a failure.
      if (!res.ok) throw new Error(body.error || "Failed to load the report");
      report.value = body;
    } catch (e) {
      error.value = e.message;
      report.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function loadOutlets () {
    try {
      const res = await fetch("/outlets?limit=1000&page=1");
      const body = await res.json();
      outlets.value = body.data || [];
    } catch {
      outlets.value = [];
    }
  }

  onMounted(async () => {
    await loadOutlets();
    await load();
    if (error.value) {
      store.commit("setMessage", { type: "error", text: error.value });
    }
  });
</script>
