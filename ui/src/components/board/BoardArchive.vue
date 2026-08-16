<template>
  <v-dialog
    max-width="620"
    :model-value="modelValue"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card border rounded="lg">
      <v-card-title class="py-4">Archived items</v-card-title>
      <v-divider />
      <v-card-text style="max-height: 60vh">
        <div class="eyebrow mb-2">Cards</div>
        <div v-if="!items.cards.length" class="text-caption text-medium-emphasis mb-4">
          Nothing archived.
        </div>
        <div v-for="c in items.cards" :key="c.id" class="arch-row">
          <div class="flex-grow-1 min-w-0">
            <div class="text-body-2">{{ c.title }}</div>
            <div class="text-caption text-medium-emphasis">
              from {{ c.list_name }} · {{ relativeTime(c.updated_at) }}
            </div>
          </div>
          <v-btn
            v-if="board.canEdit"
            size="x-small"
            variant="tonal"
            @click="restoreCard(c)"
          >Restore</v-btn>
        </div>

        <div class="eyebrow mt-5 mb-2">Lists</div>
        <div v-if="!items.lists.length" class="text-caption text-medium-emphasis">
          Nothing archived.
        </div>
        <div v-for="l in items.lists" :key="l.id" class="arch-row">
          <div class="text-body-2 flex-grow-1">{{ l.name }}</div>
          <v-btn
            v-if="board.canEdit"
            size="x-small"
            variant="tonal"
            @click="restoreList(l)"
          >Restore</v-btn>
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
  import { ref, watch } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import { relativeTime } from "@/lib/boards";

  const props = defineProps({ modelValue: { type: Boolean, default: false } });
  const emit = defineEmits(["update:modelValue"]);

  const board = useBoard();
  const store = useStore();

  const items = ref({ cards: [], lists: [] });

  async function load() {
    try {
      items.value = await board.api.get(`/boards/${board.board.id}/archive`);
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  async function restoreCard(card) {
    await board.api.put(`/boards/cards/${card.id}/archive`, { archived: false });
    await load();
    await board.refresh();
  }

  async function restoreList(list) {
    await board.api.put(`/boards/lists/${list.id}/restore`);
    await load();
    await board.refresh();
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (open) load();
    },
  );
</script>

<style scoped>
.arch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.min-w-0 {
  min-width: 0;
}
.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.55);
}
</style>
