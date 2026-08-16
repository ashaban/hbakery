<template>
  <div>
    <div v-if="blockedBy.length" class="mb-3">
      <div class="text-caption text-medium-emphasis mb-1">This card is waiting on</div>
      <div v-for="c in blockedBy" :key="c.id" class="dep">
        <v-icon
          :color="isDone(c) ? 'success' : 'error'"
          :icon="isDone(c) ? 'mdi-check-circle-outline' : 'mdi-block-helper'"
          size="16"
        />
        <span class="text-body-2 flex-grow-1 dep__title" @click="emit('open', c.id)">
          {{ c.title }}
        </span>
        <v-chip v-if="c.status_name" label size="x-small" variant="tonal">{{ c.status_name }}</v-chip>
        <v-btn v-if="canEdit" icon="mdi-close" size="x-small" variant="text" @click="remove(c)" />
      </div>
    </div>

    <div v-if="blocking.length" class="mb-3">
      <div class="text-caption text-medium-emphasis mb-1">Waiting on this card</div>
      <div v-for="c in blocking" :key="c.id" class="dep">
        <v-icon class="text-medium-emphasis" icon="mdi-arrow-right-thin" size="16" />
        <span class="text-body-2 flex-grow-1 dep__title" @click="emit('open', c.id)">
          {{ c.title }}
        </span>
        <v-chip v-if="c.status_name" label size="x-small" variant="tonal">{{ c.status_name }}</v-chip>
      </div>
    </div>

    <div v-if="canEdit">
      <div v-if="picking" class="d-flex ga-2">
        <v-autocomplete
          v-model="chosen"
          autofocus
          density="compact"
          hide-details
          item-title="title"
          item-value="id"
          :items="candidates"
          label="Blocked by which card?"
        />
        <v-btn color="primary" :disabled="!chosen" flat size="small" @click="add">Add</v-btn>
        <v-btn size="small" variant="text" @click="picking = false">Cancel</v-btn>
      </div>
      <v-btn
        v-else
        prepend-icon="mdi-block-helper"
        size="small"
        variant="tonal"
        @click="openPicker"
      >Mark as blocked by…</v-btn>
    </div>

    <div
      v-if="!blockedBy.length && !blocking.length && !canEdit"
      class="text-caption text-medium-emphasis"
    >
      No dependencies.
    </div>
  </div>
</template>

<script setup>
  import { ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";

  /**
   * What this card waits on, and what waits on it. A blocker only counts
   * as cleared once it reaches a status in the DONE category, so renaming
   * statuses never breaks the logic.
   */
  const props = defineProps({
    cardId: { type: [String, Number], required: true },
    blockedBy: { type: Array, default: () => [] },
    blocking: { type: Array, default: () => [] },
    canEdit: { type: Boolean, default: false },
  });
  const emit = defineEmits(["changed", "open"]);

  const board = useBoard();
  const store = useStore();

  const picking = ref(false);
  const candidates = ref([]);
  const chosen = ref(null);

  const isDone = (c) => c.status_category === "DONE";
  const fail = (err) => store.commit("setMessage", { type: "error", text: err.message });

  async function openPicker() {
    picking.value = true;
    try {
      candidates.value = await board.api.get(
        `/boards/cards/${props.cardId}/dependency-candidates`,
      );
    } catch (err) {
      fail(err);
    }
  }

  async function add() {
    if (!chosen.value) return;
    try {
      await board.api.post(`/boards/cards/${props.cardId}/dependencies/${chosen.value}`);
      chosen.value = null;
      picking.value = false;
      emit("changed");
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function remove(c) {
    try {
      await board.api.del(`/boards/cards/${props.cardId}/dependencies/${c.id}`);
      emit("changed");
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }
</script>

<style scoped>
.dep {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.dep__title {
  cursor: pointer;
}
.dep__title:hover {
  color: rgb(var(--v-theme-primary));
}
</style>
