<template>
  <div>
    <div class="d-flex align-center ga-2 mb-3">
      <v-btn icon="mdi-chevron-left" size="small" variant="text" @click="shift(-1)" />
      <span class="text-body-1 font-weight-bold" style="min-width: 170px">{{ monthLabel }}</span>
      <v-btn icon="mdi-chevron-right" size="small" variant="text" @click="shift(1)" />
      <v-btn size="small" variant="text" @click="cursor = new Date()">Today</v-btn>
      <span v-if="board.canEdit" class="text-caption text-medium-emphasis ml-2">
        Drag a card onto a day to reschedule it
      </span>
    </div>

    <div class="cal">
      <div v-for="d in WEEKDAYS" :key="d" class="cal__weekday">{{ d }}</div>

      <template v-for="(week, wi) in weeks" :key="wi">
        <div
          v-for="day in week"
          :key="day.key"
          class="cal__day"
          :class="{ 'cal__day--out': !day.inMonth, 'cal__day--today': day.isToday }"
        >
          <div class="cal__num">{{ day.date.getDate() }}</div>
          <draggable
            class="cal__drop"
            :disabled="!board.canEdit"
            fallback-class="cal__mirror"
            :force-fallback="true"
            ghost-class="cal__ghost"
            group="calendar"
            item-key="id"
            :model-value="day.cards"
            @change="onDrop(day, $event)"
          >
            <template #item="{ element: c }">
              <div class="cal__card" @click="emit('open-card', c.id)">
                <v-icon
                  v-if="priorityMeta(c.priority)"
                  :color="priorityMeta(c.priority).color"
                  :icon="priorityMeta(c.priority).icon"
                  size="10"
                />
                {{ c.title }}
              </div>
            </template>
          </draggable>
        </div>
      </template>
    </div>

    <div v-if="undated.length" class="mt-4">
      <div class="eyebrow mb-2">No due date ({{ undated.length }})</div>
      <draggable
        class="d-flex flex-wrap ga-2"
        :disabled="!board.canEdit"
        fallback-class="cal__mirror"
        :force-fallback="true"
        group="calendar"
        item-key="id"
        :model-value="undated"
      >
        <template #item="{ element: c }">
          <div class="cal__card cal__card--loose" @click="emit('open-card', c.id)">
            {{ c.title }}
          </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup>
  import { computed, ref } from "vue";
  import draggable from "vuedraggable";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import { priorityMeta } from "@/lib/boards";

  /**
   * The same cards laid out by due date. Dragging a card onto a day
   * reschedules it, which is far quicker than opening each card to shift
   * a deadline.
   */
  const emit = defineEmits(["open-card"]);

  const board = useBoard();
  const store = useStore();

  const cursor = ref(new Date());
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const monthLabel = computed(() =>
    cursor.value.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
  );

  const dated = computed(() =>
    (board.board?.cards || []).filter((c) => c.due_at && board.matches(c)),
  );
  const undated = computed(() =>
    (board.board?.cards || []).filter((c) => !c.due_at && board.matches(c)),
  );

  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  /** Six weeks starting on the Monday on or before the 1st — a stable grid. */
  const weeks = computed(() => {
    const first = new Date(cursor.value.getFullYear(), cursor.value.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));

    const byDay = {};
    for (const c of dated.value) {
      const k = key(new Date(c.due_at));
      (byDay[k] = byDay[k] || []).push(c);
    }

    const out = [];
    for (let w = 0; w < 6; w++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        row.push({
          date: day,
          key: key(day),
          inMonth: day.getMonth() === cursor.value.getMonth(),
          isToday: key(day) === key(new Date()),
          cards: byDay[key(day)] || [],
        });
      }
      out.push(row);
    }
    return out;
  });

  const shift = (months) => {
    cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + months, 1);
  };

  /**
   * Dropping onto a day keeps the card's existing time of day — only the
   * date changes, so a 09:00 deadline stays a 09:00 deadline.
   */
  async function onDrop(day, event) {
    const change = event.added;
    if (!change) return;
    const card = change.element;
    const at = card.due_at ? new Date(card.due_at) : new Date();
    const due = new Date(day.date);
    due.setHours(at.getHours(), at.getMinutes(), 0, 0);

    const previous = card.due_at;
    board.patchCard(card.id, { due_at: due.toISOString(), due_complete: false });
    try {
      await board.api.put(`/boards/cards/${card.id}`, { due_at: due.toISOString() });
    } catch (err) {
      board.patchCard(card.id, { due_at: previous });
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }
</script>

<style scoped>
.cal {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  overflow: hidden;
  user-select: none;
}
.cal__weekday {
  background: rgb(var(--v-theme-surface));
  padding: 6px 8px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgba(0, 0, 0, 0.6);
}
.cal__day {
  background: rgb(var(--v-theme-surface));
  min-height: 104px;
  padding: 4px;
}
.cal__day--out {
  opacity: 0.45;
}
.cal__day--today {
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-primary));
}
.cal__num {
  font-size: 0.72rem;
  color: rgba(0, 0, 0, 0.6);
  padding: 0 3px 2px;
}
.cal__drop {
  min-height: 68px;
}
.cal__card {
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  padding: 3px 6px;
  margin-bottom: 3px;
  font-size: 0.74rem;
  line-height: 1.25;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal__card:hover {
  border-color: rgb(var(--v-theme-primary));
}
.cal__card--loose {
  margin: 0;
  max-width: 220px;
}
.cal__ghost {
  opacity: 0.35;
}
.cal__mirror {
  transform: rotate(2deg);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
}
.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.55);
}
</style>
