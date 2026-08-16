<template>
  <div class="d-flex ga-4 overflow-x-auto pb-4">
    <div v-for="list in lists" :key="list.id" class="kanban-list">
      <v-card class="rounded-lg" elevation="1">
        <v-card-title class="d-flex align-center py-2 px-3 bg-grey-lighten-4">
          <span class="text-subtitle-2 font-weight-bold">{{ list.name }}</span>
          <v-chip class="ml-2" size="x-small" variant="tonal">
            {{ cardsForList(list.id).length }}
          </v-chip>
          <v-spacer />
          <v-btn icon size="x-small" variant="text" @click="$emit('add-card', list.id)">
            <v-icon size="18">mdi-plus</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text class="pa-2 kanban-body">
          <draggable
            class="kanban-drop"
            :group="'cards'"
            item-key="id"
            :list="cardsForList(list.id)"
            @change="(e) => onChange(list.id, e)"
          >
            <template #item="{ element: card }">
              <v-card
                class="mb-2 kanban-card"
                :class="{ 'kanban-card--overdue': isOverdue(card) }"
                variant="outlined"
                @click="$emit('open-card', card.id)"
              >
                <v-card-text class="pa-3">
                  <div v-if="card.labels?.length" class="d-flex flex-wrap ga-1 mb-2">
                    <v-sheet
                      v-for="l in card.labels"
                      :key="l.id"
                      class="kanban-label"
                      :color="l.color"
                      rounded
                    >
                      {{ l.name }}
                    </v-sheet>
                  </div>
                  <div class="text-body-2 font-weight-medium">{{ card.title }}</div>
                  <div class="d-flex align-center mt-2 ga-2 flex-wrap">
                    <v-chip
                      v-if="card.priority"
                      :color="PRIORITY_COLORS[card.priority]"
                      size="x-small"
                      variant="flat"
                    >
                      {{ card.priority }}
                    </v-chip>
                    <v-chip v-if="card.due_at" :color="isOverdue(card) ? 'error' : 'grey'" size="x-small" variant="tonal">
                      <v-icon size="12" start>mdi-calendar</v-icon>
                      {{ formatDate(card.due_at) }}
                    </v-chip>
                    <v-chip v-if="card.checklist_total" size="x-small" variant="tonal">
                      <v-icon size="12" start>mdi-checkbox-marked-circle-outline</v-icon>
                      {{ card.checklist_done }}/{{ card.checklist_total }}
                    </v-chip>
                    <v-chip v-if="card.comment_count" size="x-small" variant="tonal">
                      <v-icon size="12" start>mdi-comment-outline</v-icon>
                      {{ card.comment_count }}
                    </v-chip>
                    <v-chip v-if="card.subtask_count" size="x-small" variant="tonal">
                      <v-icon size="12" start>mdi-file-tree-outline</v-icon>
                      {{ card.subtask_count }}
                    </v-chip>
                    <v-spacer />
                    <div v-if="card.members?.length" class="d-flex">
                      <v-avatar
                        v-for="m in card.members.slice(0, 3)"
                        :key="m.user_id"
                        color="primary"
                        size="22"
                        :title="m.name"
                      >
                        <span class="text-caption text-white">{{ initials(m.name) }}</span>
                      </v-avatar>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </template>
          </draggable>
        </v-card-text>
      </v-card>
    </div>

    <div class="kanban-list">
      <v-btn block variant="tonal" @click="$emit('add-list')">
        <v-icon start>mdi-plus</v-icon>
        Add list
      </v-btn>
    </div>
  </div>
</template>

<script setup>
  import draggable from "vuedraggable";
  import { formatDate, isOverdue, PRIORITY_COLORS } from "@/lib/boardFormat";

  const props = defineProps({
    lists: { type: Array, required: true },
    cards: { type: Array, required: true },
  });
  const emit = defineEmits(["open-card", "add-card", "add-list", "move-card"]);

  function cardsForList(listId) {
    return props.cards
      .filter((c) => c.list_id === listId)
      .sort((a, b) => a.position - b.position);
  }

  function initials(name) {
    return (name || "?")
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  // vuedraggable's "change" event fires per-list on both the source and
  // target list of a cross-list move; only the "added"/"moved" side
  // (this list) carries the info needed to compute the new position.
  function onChange(listId, event) {
    const added = event.added || event.moved;
    if (!added) return;
    const siblings = cardsForList(listId);
    const idx = added.newIndex;
    const before = siblings[idx - 1];
    const after = siblings[idx + 1];
    emit("move-card", {
      cardId: added.element.id,
      list_id: listId,
      after_id: before?.id || null,
      before_id: after?.id || null,
    });
  }
</script>

<style scoped>
.kanban-list {
  min-width: 280px;
  max-width: 280px;
}

.kanban-body {
  min-height: 40px;
  max-height: 65vh;
  overflow-y: auto;
}

.kanban-drop {
  min-height: 40px;
}

.kanban-card {
  cursor: pointer;
}

.kanban-card--overdue {
  border-color: rgb(var(--v-theme-error)) !important;
}

.kanban-label {
  color: white;
  font-size: 11px;
  padding: 1px 8px;
  font-weight: 600;
}
</style>
