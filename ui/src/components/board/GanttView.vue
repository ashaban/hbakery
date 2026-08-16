<template>
  <div v-if="!scheduled.length" class="text-center text-body-2 text-grey py-8">
    No cards have both a start and due date yet — the Gantt view plots that range.
  </div>
  <div v-else class="gantt-wrap">
    <div class="gantt-header d-flex">
      <div class="gantt-label-col" />
      <div
        v-for="day in days"
        :key="day.key"
        class="gantt-day"
        :class="{ 'gantt-day--today': day.isToday, 'gantt-day--weekend': day.isWeekend }"
      >
        {{ day.label }}
      </div>
    </div>
    <div v-for="card in scheduled" :key="card.id" class="d-flex gantt-row">
      <div class="gantt-label-col text-caption text-truncate" :title="card.title">
        {{ card.title }}
      </div>
      <div class="gantt-track" :style="{ width: `${days.length * 28}px` }">
        <div
          class="gantt-bar"
          :class="{ 'gantt-bar--overdue': isOverdue(card) }"
          :style="barStyle(card)"
          :title="`${card.title}: ${formatDate(card.start_at)} → ${formatDate(card.due_at)}`"
          @click="$emit('open-card', card.id)"
        >
          {{ card.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { computed } from "vue";
  import { formatDate, isOverdue } from "@/lib/boardFormat";

  const props = defineProps({ cards: { type: Array, required: true } });
  defineEmits(["open-card"]);

  const DAY_WIDTH = 28;

  const scheduled = computed(() =>
    props.cards
      .filter((c) => c.start_at && c.due_at)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at)),
  );

  const range = computed(() => {
    if (!scheduled.value.length) return null;
    const starts = scheduled.value.map((c) => new Date(c.start_at));
    const ends = scheduled.value.map((c) => new Date(c.due_at));
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    min.setDate(min.getDate() - 1);
    max.setDate(max.getDate() + 1);
    return { min, max };
  });

  const days = computed(() => {
    if (!range.value) return [];
    const out = [];
    const cursor = new Date(range.value.min);
    const today = new Date();
    while (cursor <= range.value.max) {
      out.push({
        key: cursor.toISOString(),
        label: cursor.getDate(),
        isToday: cursor.toDateString() === today.toDateString(),
        isWeekend: [0, 6].includes(cursor.getDay()),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  });

  function dayOffset(date) {
    return Math.round((new Date(date) - range.value.min) / 86400000);
  }

  function barStyle(card) {
    const left = dayOffset(card.start_at) * DAY_WIDTH;
    const span = Math.max(1, dayOffset(card.due_at) - dayOffset(card.start_at) + 1);
    return { left: `${left}px`, width: `${span * DAY_WIDTH - 4}px` };
  }
</script>

<style scoped>
.gantt-wrap {
  overflow-x: auto;
}

.gantt-header,
.gantt-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.gantt-label-col {
  min-width: 180px;
  max-width: 180px;
  padding: 4px 8px;
  flex-shrink: 0;
}

.gantt-day {
  width: 28px;
  flex-shrink: 0;
  text-align: center;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.5);
  padding: 4px 0;
}

.gantt-day--today {
  font-weight: bold;
  color: rgb(var(--v-theme-primary));
}

.gantt-day--weekend {
  background: rgba(0, 0, 0, 0.03);
}

.gantt-track {
  position: relative;
  height: 32px;
}

.gantt-bar {
  position: absolute;
  top: 4px;
  height: 24px;
  background: rgb(var(--v-theme-primary));
  color: white;
  border-radius: 4px;
  font-size: 11px;
  padding: 2px 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: pointer;
}

.gantt-bar--overdue {
  background: rgb(var(--v-theme-error));
}
</style>
