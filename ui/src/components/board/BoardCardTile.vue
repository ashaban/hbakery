<template>
  <v-card
    class="board-card mb-2"
    :class="{ 'board-card--selected': board.isSelected(card.id) }"
    flat
    link
    rounded="lg"
  >
    <div v-if="card.cover_color" class="board-card__cover" :style="{ background: card.cover_color }" />

    <div class="pa-3">
      <div v-if="labels.length" class="d-flex flex-wrap ga-1 mb-2">
        <span
          v-for="l in labels"
          :key="l.id"
          class="board-card__label"
          :style="{ background: l.color }"
          :title="l.name"
        >{{ l.name }}</span>
      </div>

      <div class="d-flex align-start ga-1">
        <!-- Appears once a selection is under way, or on hover, so the
             card front stays clean the rest of the time. -->
        <v-checkbox-btn
          v-if="board.canEdit"
          class="board-card__tick"
          :class="{ 'board-card__tick--on': board.selecting }"
          density="compact"
          :model-value="board.isSelected(card.id)"
          @click.stop
          @update:model-value="board.toggleSelected(card.id)"
        />
        <v-icon
          v-if="priority"
          class="mt-1"
          :color="priority.color"
          :icon="priority.icon"
          size="14"
          :title="`${priority.label} priority`"
        />
        <v-icon
          v-if="card.is_milestone"
          class="mt-1"
          color="warning"
          icon="mdi-rhombus"
          size="13"
          title="Milestone"
        />
        <div class="text-body-2 flex-grow-1" style="line-height: 1.35">{{ card.title }}</div>
      </div>

      <div v-if="hasBadges" class="d-flex align-center flex-wrap ga-2 mt-2">
        <v-chip
          v-if="card.is_blocked"
          color="error"
          label
          size="x-small"
          title="Waiting on another card"
          variant="tonal"
        >
          <v-icon icon="mdi-block-helper" size="12" start />Blocked
        </v-chip>

        <v-chip v-if="status" label size="x-small" :style="{ color: status.color }" variant="tonal">
          {{ status.name }}
        </v-chip>

        <v-chip v-if="due" :color="due.color" label size="x-small" variant="tonal">
          <v-icon :icon="due.icon" size="12" start />{{ due.text }}
        </v-chip>

        <v-chip v-if="checklist" :color="checklist.color" label size="x-small" variant="tonal">
          <v-icon icon="mdi-checkbox-marked-outline" size="12" start />{{ checklist.text }}
        </v-chip>

        <v-chip
          v-for="t in card.tags || []"
          :key="t.id"
          label
          size="x-small"
          :style="{ color: t.color }"
          variant="tonal"
        >{{ t.name }}</v-chip>

        <v-chip v-if="subtasks" label size="x-small" variant="tonal">
          <v-icon icon="mdi-file-tree-outline" size="12" start />{{ subtasks.text }}
        </v-chip>

        <v-chip
          v-for="f in frontFields"
          :key="f.id"
          label
          size="x-small"
          variant="tonal"
        >{{ f.name }}: {{ f.display }}</v-chip>

        <v-icon
          v-if="card.has_description"
          class="text-medium-emphasis"
          icon="mdi-text"
          size="15"
          title="This card has a description"
        />
        <span v-if="card.comment_count" class="badge text-medium-emphasis">
          <v-icon icon="mdi-comment-outline" size="14" />{{ card.comment_count }}
        </span>
        <span v-if="card.attachment_count" class="badge text-medium-emphasis">
          <v-icon icon="mdi-link-variant" size="14" />{{ card.attachment_count }}
        </span>
        <v-icon
          v-if="card.watching"
          class="text-medium-emphasis"
          icon="mdi-eye-outline"
          size="15"
          title="You are subscribed to this card"
        />

        <v-spacer />

        <div v-if="members.length" class="d-flex ga-1">
          <StaffAvatar v-for="m in members" :key="m.staff_id" :name="m.full_name" :size="24" />
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup>
  import { computed } from "vue";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { formatDate, priorityMeta } from "@/lib/boards";

  /** The card as it appears on the board — the "front" of the card. */
  const props = defineProps({ card: { type: Object, required: true } });

  const board = useBoard();

  const labels = computed(() =>
    (props.card.label_ids || []).map((id) => board.labelById[id]).filter(Boolean),
  );

  const members = computed(() =>
    (props.card.member_ids || []).map((id) => board.memberById[id]).filter(Boolean),
  );

  /**
   * A due date is only worth colouring once it matters: overdue is red,
   * due within a day is amber, anything already ticked off is green.
   */
  const due = computed(() => {
    if (!props.card.due_at) return null;
    const at = new Date(props.card.due_at);
    const hours = (at - new Date()) / 36e5;
    const color = props.card.due_complete
      ? "success"
      : hours < 0 ? "error"
      : hours < 24 ? "warning"
      : undefined;
    return {
      text: formatDate(at),
      color,
      icon: props.card.due_complete ? "mdi-checkbox-marked-outline" : "mdi-clock-outline",
    };
  });

  const checklist = computed(() => {
    const total = props.card.checklist_total || 0;
    if (!total) return null;
    const done = props.card.checklist_done || 0;
    return { text: `${done}/${total}`, color: done === total ? "success" : undefined };
  });

  const priority = computed(() => priorityMeta(props.card.priority));

  const status = computed(() => {
    const s = board.statusById[props.card.status_id];
    // The first status is the resting state of every new card, so showing
    // it on the front would just be noise on most of the board.
    const isFirst = s && board.statuses[0]?.id === s.id;
    return s && !isFirst ? s : null;
  });

  const subtasks = computed(() => {
    const total = props.card.subtask_total || 0;
    if (!total) return null;
    return { text: `${props.card.subtask_done || 0}/${total}` };
  });

  /** Custom fields the board owner chose to surface on the card front. */
  const frontFields = computed(() =>
    board.customFields
      .filter((f) => f.show_on_front)
      .map((f) => {
        const raw = (props.card.custom || {})[f.id];
        if (raw === undefined || raw === null || raw === "") return null;
        const display = f.type === "CHECKBOX"
          ? (raw ? "Yes" : "No")
          : f.type === "DATE" ? formatDate(raw)
          : String(raw);
        return { id: f.id, name: f.name, display };
      })
      .filter(Boolean),
  );

  const hasBadges = computed(() =>
    Boolean(
      due.value || checklist.value || subtasks.value || status.value ||
      props.card.is_blocked || props.card.has_description || props.card.comment_count ||
      props.card.attachment_count || members.value.length || props.card.watching ||
      frontFields.value.length || (props.card.tags || []).length,
    ),
  );
</script>

<style scoped>
.board-card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(0, 0, 0, 0.12);
  cursor: pointer;
}
.board-card:hover {
  border-color: rgb(var(--v-theme-primary));
}
.board-card--selected {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
}
.board-card__tick {
  margin: -4px 0 0 -6px;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.board-card:hover .board-card__tick,
.board-card__tick--on {
  opacity: 1;
}
.board-card__cover {
  height: 30px;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
}
.board-card__label {
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  padding: 4px 7px;
  border-radius: 4px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
