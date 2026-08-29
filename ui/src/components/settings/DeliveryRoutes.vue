<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6 d-flex align-center flex-wrap ga-4">
        <v-avatar color="primary" size="56">
          <v-icon color="white" size="32">mdi-map-marker-path</v-icon>
        </v-avatar>
        <div>
          <h1 class="text-h4 font-weight-bold text-primary">Delivery Routes</h1>
          <p class="text-body-1 text-grey mt-1 mb-0">
            The rounds you deliver on and what each costs. Any vehicle can be
            assigned a route — you pick both on the transfer.
          </p>
        </div>
        <v-spacer />
        <v-btn
          v-if="canManage"
          color="primary"
          size="large"
          @click="openEditor(null)"
        >
          <v-icon start>mdi-plus</v-icon>
          New Route
        </v-btn>
      </v-card-text>
    </v-card>

    <v-card class="rounded-lg" elevation="2">
      <v-progress-linear :active="loading" color="primary" height="4" indeterminate />

      <div v-if="!loading && !routes.length" class="pa-12 text-center">
        <v-icon class="mb-4" color="grey-lighten-1" size="64">mdi-map-marker-off</v-icon>
        <div class="text-h6 text-grey">No routes yet</div>
        <div class="text-body-2 text-grey">
          Add one so vehicle deliveries can pick up their costs.
        </div>
      </div>

      <v-table v-else density="comfortable">
        <thead>
          <tr class="bg-grey-lighten-4">
            <th class="text-left">ROUTE</th>
            <th class="text-left">COSTS</th>
            <th class="text-right">TOTAL</th>
            <th class="text-right">USED BY</th>
            <th class="text-right">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in routes" :key="r.id">
            <td>
              <div class="font-weight-medium">
                {{ r.name }}
                <v-chip
                  v-if="!r.is_active"
                  class="ml-1"
                  color="grey"
                  size="x-small"
                  variant="tonal"
                >Inactive</v-chip>
              </div>
              <div v-if="r.notes" class="text-caption text-grey">{{ r.notes }}</div>
            </td>
            <td>
              <div v-if="r.costs.length" class="d-flex flex-wrap ga-1">
                <v-chip
                  v-for="c in r.costs"
                  :key="c.cost_type_id"
                  size="x-small"
                  variant="outlined"
                >{{ c.name }} {{ money(c.amount) }}</v-chip>
              </div>
              <!--
                A route with no costs still resolves on a transfer but adds
                nothing, so it is worth flagging rather than showing blank.
              -->
              <span v-else class="text-caption text-warning">No costs set</span>
            </td>
            <td class="text-right font-weight-bold text-green-darken-2">
              {{ money(r.total_cost) }}
            </td>
            <td class="text-right text-body-2">
              {{ r.transfer_count }} transfer(s)
            </td>
            <td class="text-right">
              <v-btn size="small" variant="text" @click="openViewer(r)">
                <v-icon size="16" start>mdi-eye</v-icon>
                View
              </v-btn>
              <v-btn
                v-if="canManage"
                size="small"
                variant="text"
                @click="openEditor(r)"
              >Edit</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- VIEW -->
    <v-dialog v-model="viewDialog" max-width="560">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-map-marker-path</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ viewing?.name }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="viewDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text v-if="viewing" class="pa-6">
          <div v-if="viewing.notes" class="text-body-2 text-grey mb-4">
            {{ viewing.notes }}
          </div>
          <v-table density="compact">
            <thead>
              <tr class="bg-grey-lighten-4">
                <th class="text-left">COST</th>
                <th class="text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in viewing.costs" :key="c.cost_type_id">
                <td>{{ c.name }}</td>
                <td class="text-right">{{ money(c.amount) }}</td>
              </tr>
              <tr v-if="!viewing.costs.length">
                <td class="text-center text-grey py-4" colspan="2">
                  No costs set on this route.
                </td>
              </tr>
            </tbody>
            <tfoot v-if="viewing.costs.length">
              <tr>
                <td class="font-weight-bold">TOTAL PER RUN</td>
                <td class="text-right font-weight-bold text-green-darken-2">
                  {{ money(viewing.total_cost) }}
                </td>
              </tr>
            </tfoot>
          </v-table>
          <div class="text-caption text-grey mt-3">
            Used on {{ viewing.transfer_count }} transfer(s).
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="viewDialog = false">Close</v-btn>
          <v-btn
            v-if="canManage"
            color="primary"
            variant="flat"
            @click="viewDialog = false; openEditor(viewing)"
          >Edit Route</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ADD / EDIT -->
    <v-dialog v-model="editDialog" max-width="640" scrollable>
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">{{ editing ? "mdi-pencil" : "mdi-plus" }}</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">
            {{ editing ? "Edit Route" : "New Route" }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="editDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pa-6">
          <v-text-field
            v-model="form.name"
            label="Route name"
            placeholder="e.g. Town run"
            variant="outlined"
          />
          <v-text-field
            v-model="form.notes"
            label="Notes (optional)"
            variant="outlined"
          />
          <v-switch
            v-if="editing"
            v-model="form.is_active"
            color="primary"
            hide-details
            label="Active"
          />

          <div class="text-caption text-grey mt-4 mb-1">COSTS PER RUN</div>
          <CostLines v-model="form.costs" :cost-types="costTypes" @type-added="loadTypes" />

          <v-alert v-if="error" class="mt-3" density="compact" type="error" variant="tonal">
            {{ error }}
          </v-alert>
        </v-card-text>

        <v-divider />
        <v-card-actions class="pa-4">
          <v-btn
            v-if="editing"
            color="error"
            :disabled="editing.transfer_count > 0"
            variant="text"
            @click="remove"
          >
            <v-icon start>mdi-delete</v-icon>
            Delete
          </v-btn>
          <!--
            A route already used cannot be deleted: those deliveries were
            costed with it, and removing it would orphan them.
          -->
          <span
            v-if="editing && editing.transfer_count > 0"
            class="text-caption text-grey"
          >Used by {{ editing.transfer_count }} transfer(s) — deactivate instead</span>
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false">Cancel</v-btn>
          <v-btn color="primary" :loading="saving" variant="flat" @click="save">
            {{ editing ? "Save Route" : "Create Route" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { computed, onMounted, reactive, ref } from "vue";
  import { useStore } from "vuex";
  import CostLines from "./CostLines.vue";

  const store = useStore();
  const canManage = computed(() =>
    store.getters.hasTask("can_manage_delivery_costs"),
  );

  const loading = ref(false);
  const saving = ref(false);
  const routes = ref([]);
  const costTypes = ref([]);
  const error = ref("");

  const viewDialog = ref(false);
  const viewing = ref(null);
  const editDialog = ref(false);
  const editing = ref(null);

  const form = reactive({ name: "", notes: "", is_active: true, costs: [] });

  function money (v) {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function loadTypes () {
    const t = await fetch("/delivery/cost-types").then((x) => x.json());
    costTypes.value = t.data || [];
  }

  async function load () {
    loading.value = true;
    try {
      const r = await fetch("/delivery/routes?include_inactive=true").then((x) => x.json());
      routes.value = r.data || [];
      await loadTypes();
    } catch {
      store.commit("setMessage", { type: "error", text: "Failed to load routes" });
    } finally {
      loading.value = false;
    }
  }

  function openViewer (r) {
    viewing.value = r;
    viewDialog.value = true;
  }

  function openEditor (r) {
    editing.value = r;
    error.value = "";
    form.name = r?.name || "";
    form.notes = r?.notes || "";
    form.is_active = r ? r.is_active : true;
    form.costs = (r?.costs || []).map((c) => ({
      cost_type_id: c.cost_type_id,
      amount: Number(c.amount),
    }));
    editDialog.value = true;
  }

  async function save () {
    error.value = "";
    if (!form.name.trim()) {
      error.value = "A route name is required";
      return;
    }
    saving.value = true;
    try {
      const url = editing.value ? `/delivery/routes/${editing.value.id}` : "/delivery/routes";
      const res = await fetch(url, {
        method: editing.value ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          notes: form.notes || null,
          is_active: form.is_active,
          costs: form.costs,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save route");
      editDialog.value = false;
      await load();
      store.commit("setMessage", {
        type: "success",
        text: editing.value ? "Route saved" : "Route created",
      });
    } catch (e) {
      error.value = e.message;
    } finally {
      saving.value = false;
    }
  }

  async function remove () {
    try {
      const res = await fetch(`/delivery/routes/${editing.value.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to delete route");
      editDialog.value = false;
      await load();
      store.commit("setMessage", { type: "info", text: "Route deleted" });
    } catch (e) {
      error.value = e.message;
    }
  }

  onMounted(load);
</script>
