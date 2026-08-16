<template>
  <div>
    <div class="d-flex align-center mb-4">
      <v-btn icon size="small" variant="text" @click="shiftMonth(-1)">
        <v-icon>mdi-chevron-left</v-icon>
      </v-btn>
      <div class="text-subtitle-1 font-weight-bold mx-2">{{ monthLabel }}</div>
      <v-btn icon size="small" variant="text" @click="shiftMonth(1)">
        <v-icon>mdi-chevron-right</v-icon>
      </v-btn>
      <v-btn class="ml-2" size="small" variant="text" @click="cursor = new Date()">Today</v-btn>
    </div>

    <div class="calendar-grid">
      <div v-for="d in weekdayLabels" :key="d" class="calendar-head">{{ d }}</div>
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="calendar-cell"
        :class="{ 'calendar-cell--muted': !cell.inMonth, 'calendar-cell--today': cell.isToday }"
      >
        <div class="text-caption">{{ cell.day }}</div>
        <div
          v-for="card in cell.cards"
          :key="card.id"
          class="calendar-card"
          :class="{ 'calendar-card--overdue': isOverdue(card) }"
          @click="$emit('open-card', card.id)"
        >
          {{ card.title }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { computed, ref } from "vue";
  import { isOverdue } from "@/lib/boardFormat";

  const props = defineProps({ cards: { type: Array, required: true } });
  defineEmits(["open-card"]);

  const cursor = ref(new Date());
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function shiftMonth(delta) {
    const d = new Date(cursor.value);
    d.setMonth(d.getMonth() + delta);
    cursor.value = d;
  }

  const monthLabel = computed(() =>
    cursor.value.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  );

  function dateKey(d) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  const cards = computed(() => props.cards.filter((c) => c.due_at));

  const cells = computed(() => {
    const year = cursor.value.getFullYear();
    const month = cursor.value.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // ISO weekday, Monday first.
    const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - leadingBlank);

    const today = new Date();
    const out = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = dateKey(d);
      out.push({
        key,
        day: d.getDate(),
        inMonth: d.getMonth() === month,
        isToday: dateKey(today) === key,
        cards: cards.value.filter((c) => dateKey(new Date(c.due_at)) === key),
      });
    }
    return out;
  });
</script>

<style scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-head {
  text-align: center;
  font-weight: 600;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.6);
  padding-bottom: 4px;
}

.calendar-cell {
  min-height: 90px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 4px;
}

.calendar-cell--muted {
  opacity: 0.4;
}

.calendar-cell--today {
  border-color: rgb(var(--v-theme-primary));
  border-width: 2px;
}

.calendar-card {
  font-size: 11px;
  background: rgb(var(--v-theme-primary));
  color: white;
  border-radius: 4px;
  padding: 2px 4px;
  margin-top: 2px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.calendar-card--overdue {
  background: rgb(var(--v-theme-error));
}
</style>
