<template>
  <div>
    <v-table density="compact">
      <thead>
        <tr class="bg-grey-lighten-4">
          <th class="text-left">COST</th>
          <th class="text-right" style="width: 200px">AMOUNT</th>
          <th style="width: 56px" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="(line, i) in lines" :key="i">
          <td>
            <v-select
              v-model="line.cost_type_id"
              density="compact"
              hide-details
              item-title="name"
              item-value="id"
              :items="costTypes"
              placeholder="Select a cost"
              variant="outlined"
            />
          </td>
          <td>
            <v-text-field
              v-model.number="line.amount"
              density="compact"
              hide-details
              min="0"
              reverse
              type="number"
              variant="outlined"
            />
          </td>
          <td>
            <v-btn color="error" icon size="x-small" variant="text" @click="remove(i)">
              <v-icon size="18">mdi-close</v-icon>
            </v-btn>
          </td>
        </tr>
        <tr v-if="!lines.length">
          <td class="text-center text-grey py-4" colspan="3">
            No costs yet.
          </td>
        </tr>
      </tbody>
      <tfoot v-if="lines.length">
        <tr>
          <td class="font-weight-bold">TOTAL</td>
          <td class="text-right font-weight-bold text-green-darken-2">
            {{ money(total) }}
          </td>
          <td />
        </tr>
      </tfoot>
    </v-table>

    <div class="d-flex align-center ga-2 mt-2">
      <v-btn size="small" variant="tonal" @click="add">
        <v-icon start>mdi-plus</v-icon>
        Add cost
      </v-btn>
      <v-btn size="small" variant="text" @click="showNewType = true">
        <v-icon start>mdi-tag-plus</v-icon>
        New cost type
      </v-btn>
    </div>

    <v-dialog v-model="showNewType" max-width="420">
      <v-card class="rounded-lg">
        <v-card-title>New cost type</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newTypeName"
            autofocus
            label="Name"
            placeholder="e.g. Weighbridge"
            variant="outlined"
            @keyup.enter="createType"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showNewType = false">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="createType">Add</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
  import { computed, ref } from "vue";
  import { useStore } from "vuex";

  const props = defineProps({
    modelValue: { type: Array, default: () => [] },
    costTypes: { type: Array, default: () => [] },
  });
  const emit = defineEmits(["update:modelValue", "type-added"]);
  const store = useStore();

  const lines = computed({
    get: () => props.modelValue,
    set: (v) => emit("update:modelValue", v),
  });

  const total = computed(() =>
    lines.value.reduce((s, l) => s + (Number(l.amount) || 0), 0),
  );

  const add = () => lines.value.push({ cost_type_id: null, amount: null });
  const remove = (i) => lines.value.splice(i, 1);

  const showNewType = ref(false);
  const newTypeName = ref("");

  function money (v) {
    return Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /** Adds a cost type without leaving the form — the list is meant to grow
   *  as new kinds of cost turn up, and forcing a detour to a settings screen
   *  is how people end up lumping everything under "Transport". */
  async function createType () {
    const name = newTypeName.value.trim();
    if (!name) return;
    try {
      const res = await fetch("/delivery/cost-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to add cost type");
      emit("type-added", body.data);
      lines.value.push({ cost_type_id: body.data.id, amount: null });
      newTypeName.value = "";
      showNewType.value = false;
    } catch (e) {
      store.commit("setMessage", { type: "error", text: e.message });
    }
  }
</script>
