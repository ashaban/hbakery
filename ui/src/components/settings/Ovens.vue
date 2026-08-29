<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6 d-flex align-center flex-wrap ga-4">
        <v-avatar color="primary" size="56">
          <v-icon color="white" size="32">mdi-stove</v-icon>
        </v-avatar>
        <div>
          <h1 class="text-h4 font-weight-bold text-primary">Ovens &amp; Fuel</h1>
          <p class="text-body-1 text-grey mt-1 mb-0">
            What each jiko burns, and what that fuel costs.
          </p>
        </div>
        <v-spacer />
        <v-btn v-if="canManage" color="primary" size="large" @click="openOven(null)">
          <v-icon start>mdi-plus</v-icon>
          New Oven
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- FUEL PRICES -->
    <v-card class="mb-4 rounded-lg" elevation="2">
      <v-card-title class="d-flex align-center flex-wrap py-3">
        <v-icon class="mr-2" color="primary">mdi-fuel</v-icon>
        <span class="text-subtitle-1 font-weight-bold">Fuel Prices</span>
        <span class="text-caption text-grey ml-3">
          Used to value what a fuel oven burns
        </span>
        <v-spacer />
        <v-btn v-if="canManage" size="small" variant="tonal" @click="saveAllFuels">
          <v-icon start>mdi-content-save</v-icon>
          Save prices
        </v-btn>
      </v-card-title>
      <v-divider />
      <v-table density="compact">
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="text-left">FUEL</th>
            <th class="text-right" style="width: 240px">PRICE PER LITRE</th>
            <th style="width: 120px" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in fuels" :key="f.id">
            <td class="font-weight-medium">{{ f.name }}</td>
            <td>
              <v-text-field
                v-model.number="f.price_per_litre"
                density="compact"
                :disabled="!canManage"
                hide-details
                min="0"
                reverse
                type="number"
                variant="outlined"
              />
            </td>
            <td class="text-right">
              <!--
                A fuel left at zero cannot price a bake. Saying so beats
                letting it quietly produce no cost.
              -->
              <v-chip
                v-if="!Number(f.price_per_litre)"
                color="warning"
                size="x-small"
                variant="tonal"
              >Not set</v-chip>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- OVENS -->
    <v-card class="rounded-lg" elevation="2">
      <v-progress-linear :active="loading" color="primary" height="4" indeterminate />
      <div v-if="!loading && !ovens.length" class="pa-12 text-center">
        <v-icon class="mb-4" color="grey-lighten-1" size="64">mdi-stove</v-icon>
        <div class="text-h6 text-grey">No ovens yet</div>
        <div class="text-body-2 text-grey">
          Add one, then set how long each product needs in it.
        </div>
      </div>
      <v-table v-else density="comfortable">
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="text-left">OVEN</th>
            <th class="text-left">TYPE</th>
            <th class="text-left">BURN RATE</th>
            <th class="text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in ovens" :key="o.id">
            <td>
              <div class="font-weight-medium">
                {{ o.name }}
                <v-chip
                  v-if="!o.is_active"
                  class="ml-1"
                  color="grey"
                  size="x-small"
                  variant="tonal"
                >Inactive</v-chip>
              </div>
              <div v-if="o.notes" class="text-caption text-grey">{{ o.notes }}</div>
            </td>
            <td>
              <v-chip
                :color="o.kind === 'FUEL' ? 'orange' : 'blue'"
                size="small"
                variant="tonal"
              >{{ o.kind === "FUEL" ? "Fuel" : "Electric" }}</v-chip>
            </td>
            <td class="text-body-2">
              <template v-if="o.kind === 'FUEL'">
                {{ o.litres_per_period }} litres of {{ o.fuel_name }}
                per {{ Number(o.burn_minutes) }} min
                <div v-if="!Number(o.price_per_litre)" class="text-caption text-warning">
                  {{ o.fuel_name }} has no price set
                </div>
              </template>
              <template v-else>
                {{ money(o.cost_per_period) }} of units per
                {{ Number(o.burn_minutes) }} min
              </template>
            </td>
            <td class="text-right">
              <v-btn v-if="canManage" size="small" variant="text" @click="openOven(o)">
                Edit
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- ADD / EDIT OVEN -->
    <v-dialog v-model="ovenDialog" max-width="620">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-stove</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ editing ? "Edit Oven" : "New Oven" }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="ovenDialog = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-text-field
            v-model="form.name"
            label="Oven name"
            placeholder="e.g. Jiko A"
            variant="outlined"
          />

          <v-btn-toggle
            v-model="form.kind"
            class="mb-4"
            color="primary"
            mandatory
            variant="outlined"
          >
            <v-btn value="FUEL"><v-icon start>mdi-fire</v-icon>Fuel</v-btn>
            <v-btn value="ELECTRIC"><v-icon start>mdi-flash</v-icon>Electric</v-btn>
          </v-btn-toggle>

          <!--
            Both kinds are stated as "this much, per this many minutes" —
            the way the person running the oven actually observes it.
          -->
          <v-row dense>
            <v-col v-if="form.kind === 'FUEL'" cols="12" md="5">
              <v-text-field
                v-model.number="form.litres_per_period"
                label="Litres burnt"
                min="0"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col v-else cols="12" md="5">
              <v-text-field
                v-model.number="form.cost_per_period"
                label="Units burnt (TZS)"
                min="0"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="form.burn_minutes"
                label="in minutes"
                min="1"
                type="number"
                variant="outlined"
              />
            </v-col>
            <v-col v-if="form.kind === 'FUEL'" cols="12" md="4">
              <v-select
                v-model="form.fuel_type_id"
                item-title="name"
                item-value="id"
                :items="fuels"
                label="Fuel"
                variant="outlined"
              />
            </v-col>
          </v-row>

          <!-- Reads the rate back as a sentence, so a mis-typed number shows. -->
          <v-alert class="mb-3" density="compact" type="info" variant="tonal">
            {{ rateSummary }}
          </v-alert>

          <v-text-field v-model="form.notes" label="Notes (optional)" variant="outlined" />
          <v-switch
            v-if="editing"
            v-model="form.is_active"
            color="primary"
            hide-details
            label="Active"
          />

          <v-alert v-if="error" class="mt-3" density="compact" type="error" variant="tonal">
            {{ error }}
          </v-alert>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="ovenDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" variant="flat" @click="saveOven">
            {{ editing ? "Save Oven" : "Create Oven" }}
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
  const canManage = computed(() => store.getters.hasTask("can_manage_ovens"));

  const loading = ref(false);
  const saving = ref(false);
  const ovens = ref([]);
  const fuels = ref([]);
  const ovenDialog = ref(false);
  const editing = ref(null);
  const error = ref("");

  const form = reactive({
    name: "", kind: "FUEL", burn_minutes: 10,
    litres_per_period: null, cost_per_period: null,
    fuel_type_id: null, notes: "", is_active: true,
  });

  function money (v) {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
  }

  const rateSummary = computed(() => {
    const mins = Number(form.burn_minutes) || 0;
    if (!mins) return "Set how many minutes that burn lasts.";
    if (form.kind === "FUEL") {
      const litres = Number(form.litres_per_period) || 0;
      if (!litres) return "Set how many litres burn in that time.";
      const fuel = fuels.value.find((f) => f.id === form.fuel_type_id);
      const price = Number(fuel?.price_per_litre) || 0;
      const perHour = (litres / mins) * 60;
      return price
        ? `${litres} litres every ${mins} min — about ${perHour.toFixed(1)} litres an hour, ${money(perHour * price)} an hour.`
        : `${litres} litres every ${mins} min — about ${perHour.toFixed(1)} litres an hour. Set a price for ${fuel?.name || "this fuel"} to get a cost.`;
    }
    const cost = Number(form.cost_per_period) || 0;
    if (!cost) return "Set how many shillings of units burn in that time.";
    return `${money(cost)} every ${mins} min — about ${money((cost / mins) * 60)} an hour.`;
  });

  async function load () {
    loading.value = true;
    try {
      const [o, f] = await Promise.all([
        fetch("/ovens?include_inactive=true").then((r) => r.json()),
        fetch("/ovens/fuels").then((r) => r.json()),
      ]);
      ovens.value = o.data || [];
      fuels.value = (f.data || []).map((x) => ({
        ...x, price_per_litre: Number(x.price_per_litre),
      }));
    } catch {
      store.commit("setMessage", { type: "error", text: "Failed to load ovens" });
    } finally {
      loading.value = false;
    }
  }

  async function saveFuel (f) {
    const res = await fetch(`/ovens/fuels/${f.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_per_litre: Number(f.price_per_litre) || 0 }),
    });
    if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
  }

  async function saveAllFuels () {
    try {
      for (const f of fuels.value) await saveFuel(f);
      await load();
      store.commit("setMessage", { type: "success", text: "Fuel prices saved" });
    } catch (e) {
      store.commit("setMessage", { type: "error", text: e.message });
    }
  }

  function openOven (o) {
    editing.value = o;
    error.value = "";
    Object.assign(form, {
      name: o?.name || "",
      kind: o?.kind || "FUEL",
      burn_minutes: Number(o?.burn_minutes) || 10,
      litres_per_period: o?.litres_per_period ? Number(o.litres_per_period) : null,
      cost_per_period: o?.cost_per_period ? Number(o.cost_per_period) : null,
      fuel_type_id: o?.fuel_type_id || fuels.value[0]?.id || null,
      notes: o?.notes || "",
      is_active: o ? o.is_active : true,
    });
    ovenDialog.value = true;
  }

  async function saveOven () {
    error.value = "";
    saving.value = true;
    try {
      const url = editing.value ? `/ovens/${editing.value.id}` : "/ovens";
      const res = await fetch(url, {
        method: editing.value ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save oven");
      ovenDialog.value = false;
      await load();
      store.commit("setMessage", {
        type: "success",
        text: editing.value ? "Oven saved" : "Oven created",
      });
    } catch (e) {
      error.value = e.message;
    } finally {
      saving.value = false;
    }
  }

  onMounted(load);
</script>
