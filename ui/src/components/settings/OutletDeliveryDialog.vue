<template>
  <v-dialog v-model="open" max-width="900" scrollable>
    <v-card class="rounded-lg">
      <v-toolbar color="primary" density="comfortable">
        <v-avatar class="mr-3" color="primary" size="40">
          <v-icon color="white">mdi-truck-delivery</v-icon>
        </v-avatar>
        <v-toolbar-title class="text-h6 font-weight-bold">
          Delivery &amp; Selling Costs — {{ outlet?.name }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="open = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text class="pa-0">
        <v-tabs v-model="tab" bg-color="grey-lighten-4" color="primary">
          <!--
            A vehicle's delivery cost comes from the route it is assigned on
            the day, which lives on the Delivery Routes screen. Only a shop
            has costs of its own.
          -->
          <v-tab v-if="!isVehicle" value="costs">Delivery Costs</v-tab>
          <v-tab value="staff">Who Sells Here</v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <!-- STANDING COSTS (shop outlets) -->
          <v-window-item value="costs">
            <div class="pa-5">
              <div class="text-body-2 text-grey mb-3">
                What it costs to deliver to this shop. These are shared across
                the units on each transfer here.
              </div>
              <CostLines v-model="shopCosts" :cost-types="costTypes" />
              <div class="d-flex justify-end mt-3">
                <v-btn
                  color="primary"
                  :loading="saving"
                  variant="flat"
                  @click="saveShopCosts"
                >Save Costs</v-btn>
              </div>
            </div>
          </v-window-item>

          <!-- SELLING STAFF -->
          <v-window-item value="staff">
            <div class="pa-5">
              <div class="text-body-2 text-grey mb-3">
                <template v-if="isVehicle">
                  A vehicle's seller is the driver named on each transfer, so
                  there is nothing to set here — this list is only for
                  reference.
                </template>
                <template v-else>
                  Their daily pay is shared across everything this shop sells
                  that day.
                </template>
              </div>

              <v-autocomplete
                v-if="!isVehicle"
                v-model="selectedStaff"
                chips
                closable-chips
                item-title="name"
                item-value="id"
                :items="staffOptions"
                label="Staff selling here"
                multiple
                variant="outlined"
              />

              <v-table v-if="selectedStaff.length" density="compact">
                <thead>
                  <tr class="bg-grey-lighten-4">
                    <th class="text-left">STAFF</th>
                    <th class="text-left">POSITION</th>
                    <th class="text-right">DAILY RATE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="s in selectedStaffRows" :key="s.id">
                    <td class="font-weight-medium">{{ s.name }}</td>
                    <td class="text-body-2 text-grey">{{ s.position || "—" }}</td>
                    <td class="text-right">
                      <span v-if="s.daily_salary">{{ money(s.daily_salary) }}</span>
                      <!--
                        Called out rather than shown as 0: without a rate this
                        person adds nothing to the day's selling cost, and a 0
                        would read as a decision rather than a gap.
                      -->
                      <span v-else class="text-caption text-warning">No rate set</span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td class="font-weight-bold" colspan="2">TOTAL PER DAY</td>
                    <td class="text-right font-weight-bold text-green-darken-2">
                      {{ money(staffTotal) }}
                    </td>
                  </tr>
                </tfoot>
              </v-table>

              <div v-if="!isVehicle" class="d-flex justify-end mt-3">
                <v-btn
                  color="primary"
                  :loading="saving"
                  variant="flat"
                  @click="saveStaff"
                >Save Staff</v-btn>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="open = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { computed, ref, watch } from "vue";
  import { useStore } from "vuex";
  import CostLines from "./CostLines.vue";

  const props = defineProps({
    modelValue: { type: Boolean, default: false },
    outlet: { type: Object, default: null },
  });
  const emit = defineEmits(["update:modelValue"]);
  const store = useStore();

  const open = computed({
    get: () => props.modelValue,
    set: (v) => emit("update:modelValue", v),
  });

  const isVehicle = computed(() => props.outlet?.type === "CAR");
  const tab = ref("routes");
  const loading = ref(false);
  const saving = ref(false);

  const costTypes = ref([]);
  const shopCosts = ref([]);
  const allStaff = ref([]);
  const selectedStaff = ref([]);

  const staffOptions = computed(() => allStaff.value);
  const selectedStaffRows = computed(() =>
    selectedStaff.value
      .map((id) => allStaff.value.find((s) => s.id === id))
      .filter(Boolean),
  );
  const staffTotal = computed(() =>
    selectedStaffRows.value.reduce((sum, s) => sum + Number(s.daily_salary || 0), 0),
  );

  function money (v) {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function load () {
    if (!props.outlet) return;
    loading.value = true;
    try {
      const [types, staff] = await Promise.all([
        fetch("/delivery/cost-types").then((r) => r.json()),
        fetch("/staffs?limit=500").then((r) => r.json()),
      ]);
      costTypes.value = types.data || [];
      allStaff.value = (staff.data || staff || []).filter((s) => s.status === "Active");

      if (!isVehicle.value) {
        const c = await fetch(`/delivery/outlets/${props.outlet.id}/costs`);
        shopCosts.value = ((await c.json()).data || []).map((x) => ({
          cost_type_id: x.cost_type_id,
          amount: Number(x.amount),
        }));
      }

      const s = await fetch(`/delivery/outlets/${props.outlet.id}/staff`);
      selectedStaff.value = ((await s.json()).data || [])
        .filter((x) => x.is_active)
        .map((x) => x.staff_id);
    } catch {
      store.commit("setMessage", { type: "error", text: "Failed to load delivery costs" });
    } finally {
      loading.value = false;
    }
  }



  async function saveShopCosts () {
    saving.value = true;
    try {
      const res = await fetch(`/delivery/outlets/${props.outlet.id}/costs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costs: shopCosts.value }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      store.commit("setMessage", { type: "success", text: "Delivery costs saved" });
    } catch (e) {
      store.commit("setMessage", { type: "error", text: e.message });
    } finally {
      saving.value = false;
    }
  }

  async function saveStaff () {
    saving.value = true;
    try {
      const res = await fetch(`/delivery/outlets/${props.outlet.id}/staff`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff: selectedStaff.value.map((id) => ({ staff_id: id })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      store.commit("setMessage", { type: "success", text: "Staff saved" });
    } catch (e) {
      store.commit("setMessage", { type: "error", text: e.message });
    } finally {
      saving.value = false;
    }
  }

  watch(
    () => [props.modelValue, props.outlet?.id],
    ([isOpen]) => {
      if (!isOpen) return;
      tab.value = isVehicle.value ? "staff" : "costs";
      load();
    },
  );
</script>
