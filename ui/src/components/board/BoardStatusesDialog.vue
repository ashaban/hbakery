<template>
  <v-dialog
    max-width="560"
    :model-value="modelValue"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card border rounded="lg">
      <v-card-title class="py-4">Statuses</v-card-title>
      <v-divider />
      <v-card-text>
        <v-alert class="mb-4" density="compact" type="info" variant="tonal">
          A status says how far along a card is, separately from which list
          it sits in. The <strong>Complete</strong> category is what
          dependencies and the workload view treat as "done".
        </v-alert>

        <draggable
          v-model="ordered"
          handle=".status-grip"
          item-key="id"
          @change="onDrop"
        >
          <template #item="{ element: s }">
            <div class="status-row">
              <v-icon
                class="status-grip text-medium-emphasis"
                icon="mdi-drag-horizontal-variant"
                size="16"
              />
              <span class="dot" :style="{ background: s.color }" />
              <v-text-field
                density="compact"
                hide-details
                :model-value="s.name"
                variant="plain"
                @change="rename(s, $event.target.value)"
              />
              <v-select
                density="compact"
                hide-details
                item-title="label"
                item-value="value"
                :items="STATUS_CATEGORIES"
                :model-value="s.category"
                style="max-width: 150px"
                variant="plain"
                @update:model-value="setCategory(s, $event)"
              />
              <v-btn
                color="error"
                icon="mdi-close"
                size="x-small"
                variant="text"
                @click="remove(s)"
              />
            </div>
          </template>
        </draggable>

        <v-divider class="my-3" />
        <div class="d-flex ga-2 align-center">
          <v-text-field
            v-model="draft.name"
            density="compact"
            hide-details
            label="New status"
            variant="outlined"
          />
          <v-select
            v-model="draft.category"
            density="compact"
            hide-details
            item-title="label"
            item-value="value"
            :items="STATUS_CATEGORIES"
            style="max-width: 160px"
            variant="outlined"
          />
          <v-btn color="primary" flat @click="add">Add</v-btn>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { computed, ref } from "vue";
  import draggable from "vuedraggable";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import { STATUS_CATEGORIES } from "@/lib/boards";

  defineProps({ modelValue: { type: Boolean, default: false } });
  const emit = defineEmits(["update:modelValue"]);

  const board = useBoard();
  const store = useStore();

  const draft = ref({ name: "", category: "TODO" });

  const ordered = computed({
    get: () => board.statuses,
    set: () => {
      // vuedraggable writes the reordered array back; the real move is
      // persisted in onDrop, which knows the index that changed.
    },
  });

  const fail = (err) => store.commit("setMessage", { type: "error", text: err.message });

  async function onDrop(event) {
    const change = event.moved;
    if (!change) return;
    try {
      await board.moveStatus(change.element.id, change.newIndex);
    } catch (err) {
      fail(err);
    }
  }

  async function rename(status, name) {
    if (!name?.trim() || name === status.name) return;
    try {
      await board.api.put(`/boards/statuses/${status.id}`, { name: name.trim() });
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function setCategory(status, category) {
    try {
      await board.api.put(`/boards/statuses/${status.id}`, { category });
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function add() {
    if (!draft.value.name.trim()) return;
    try {
      await board.api.post(`/boards/${board.board.id}/statuses`, {
        name: draft.value.name.trim(),
        category: draft.value.category,
      });
      draft.value = { name: "", category: "TODO" };
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function remove(status) {
    if (!window.confirm(`Delete the status "${status.name}"?`)) return;
    try {
      await board.api.del(`/boards/statuses/${status.id}`);
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }
</script>

<style scoped>
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
.status-grip {
  cursor: grab;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  flex: 0 0 auto;
}
</style>
