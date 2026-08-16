<template>
  <div>
    <div v-for="s in subtasks" :key="s.id" class="subtask">
      <v-checkbox-btn
        density="compact"
        :disabled="!canEdit"
        :model-value="done(s)"
        @update:model-value="toggle(s)"
      />
      <div class="flex-grow-1 min-w-0 subtask__body" @click="emit('open', s.id)">
        <div class="text-body-2" :class="{ 'subtask--done': done(s) }">{{ s.title }}</div>
        <div class="d-flex align-center ga-2 mt-1">
          <v-chip
            v-if="s.status_name"
            label
            size="x-small"
            :style="{ color: s.status_color }"
            variant="tonal"
          >{{ s.status_name }}</v-chip>
          <v-chip v-if="s.due_at" label size="x-small" variant="tonal">
            <v-icon icon="mdi-clock-outline" size="11" start />{{ formatDate(s.due_at) }}
          </v-chip>
          <StaffAvatar v-for="(n, i) in s.member_names" :key="i" :name="n" :size="20" />
        </div>
      </div>
      <v-btn
        v-if="canEdit"
        icon="mdi-arrow-top-right"
        size="x-small"
        title="Make this a card of its own"
        variant="text"
        @click="promote(s)"
      />
    </div>

    <div v-if="canEdit" class="mt-2">
      <div v-if="adding">
        <v-text-field
          v-model="draft"
          autofocus
          class="mb-2"
          density="compact"
          hide-details
          placeholder="Subtask title"
          variant="outlined"
          @keyup.enter="add"
          @keyup.esc="adding = false"
        />
        <div class="d-flex ga-2">
          <v-autocomplete
            v-model="assignee"
            clearable
            density="compact"
            hide-details
            item-title="full_name"
            item-value="staff_id"
            :items="board.members"
            label="Assign to"
            style="max-width: 200px"
          />
          <v-btn color="primary" flat size="small" @click="add">Add</v-btn>
          <v-btn size="small" variant="text" @click="adding = false">Cancel</v-btn>
        </div>
      </div>
      <v-btn
        v-else
        prepend-icon="mdi-file-tree-outline"
        size="small"
        variant="tonal"
        @click="adding = true"
      >Add a subtask</v-btn>
    </div>

    <div v-if="!subtasks.length && !canEdit" class="text-caption text-medium-emphasis">
      No subtasks.
    </div>
  </div>
</template>

<script setup>
  import { ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { formatDate } from "@/lib/boards";

  /**
   * Child cards. Unlike a checklist step, a subtask is a real card — it
   * has its own status, owner and deadline, and can be opened in its own
   * right.
   */
  const props = defineProps({
    cardId: { type: [String, Number], required: true },
    subtasks: { type: Array, default: () => [] },
    canEdit: { type: Boolean, default: false },
  });
  const emit = defineEmits(["changed", "open"]);

  const board = useBoard();
  const store = useStore();

  const adding = ref(false);
  const draft = ref("");
  const assignee = ref(null);

  const done = (s) => s.status_category === "DONE";

  const fail = (err) => store.commit("setMessage", { type: "error", text: err.message });

  async function add() {
    if (!draft.value.trim()) return;
    try {
      await board.api.post(`/boards/cards/${props.cardId}/subtasks`, {
        title: draft.value.trim(),
        assignee_id: assignee.value,
      });
      draft.value = "";
      assignee.value = null;
      emit("changed");
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }

  /** Ticking a subtask moves it to the board's DONE status. */
  async function toggle(s, force = false) {
    const target = board.statuses.find((x) => x.category === (done(s) ? "TODO" : "DONE"));
    if (!target) return;
    try {
      await board.api.put(`/boards/cards/${s.id}`, {
        status_id: target.id,
        ...(force ? { force: true } : {}),
      });
      emit("changed");
      await board.refresh();
    } catch (err) {
      if (err?.status === 409 && err.details?.blocked_by) {
        const blockers = err.details.blocked_by.map((t) => `"${t}"`).join(", ");
        if (window.confirm(`"${s.title}" is still waiting on ${blockers}.\n\nComplete it anyway?`)) {
          return toggle(s, true);
        }
        return;
      }
      fail(err);
    }
  }

  async function promote(s) {
    if (!window.confirm(`Turn "${s.title}" into a card of its own on the board?`)) return;
    try {
      await board.api.put(`/boards/cards/${s.id}/promote`);
      emit("changed");
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }
</script>

<style scoped>
.subtask {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 2px 0;
}
.subtask__body {
  cursor: pointer;
}
.subtask__body:hover .text-body-2 {
  color: rgb(var(--v-theme-primary));
}
.subtask--done {
  text-decoration: line-through;
  opacity: 0.6;
}
.min-w-0 {
  min-width: 0;
}
</style>
