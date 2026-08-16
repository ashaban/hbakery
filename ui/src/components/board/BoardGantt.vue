<template>
  <div>
    <div class="d-flex align-center ga-2 mb-3">
      <v-btn-toggle v-model="zoom" density="compact" divided mandatory variant="outlined">
        <v-btn v-for="(z, i) in ZOOMS" :key="z.label" size="small" :value="i">{{ z.label }}</v-btn>
      </v-btn-toggle>
      <span v-if="board.canEdit" class="text-caption text-medium-emphasis">
        Drag a bar sideways to reschedule it
      </span>
    </div>

    <v-card v-if="bars.length" rounded="lg" variant="outlined">
      <div class="gantt">
        <!-- Names stay put while the chart scrolls under them. -->
        <div class="gantt__labels" :style="{ width: `${LABEL_W}px` }">
          <div class="gantt__head" />
          <div
            v-for="b in bars"
            :key="b.card.id"
            class="gantt__label"
            :style="{ height: `${ROW_H}px` }"
            @click="emit('open-card', b.card.id)"
          >
            <v-icon
              v-if="b.card.is_milestone"
              color="warning"
              icon="mdi-rhombus"
              size="11"
            />
            <span class="text-truncate">{{ b.card.title }}</span>
          </div>
        </div>

        <div class="gantt__scroll">
          <div :style="{ width: `${chartWidth}px`, position: 'relative' }">
            <div class="gantt__head">
              <div
                v-for="t in ticks"
                :key="t.x"
                class="gantt__tick"
                :class="{ 'gantt__tick--strong': t.strong }"
                :style="{ left: `${t.x}px` }"
              >{{ t.label }}</div>
            </div>

            <div :style="{ position: 'relative', height: `${bars.length * ROW_H}px` }">
              <div
                v-for="t in ticks"
                :key="`g${t.x}`"
                class="gantt__grid"
                :style="{ left: `${t.x}px` }"
              />
              <div v-if="todayX !== null" class="gantt__today" :style="{ left: `${todayX}px` }" />

              <template v-for="b in bars" :key="b.card.id">
                <div
                  v-if="b.card.is_milestone"
                  class="gantt__milestone"
                  :style="{
                    left: `${b.x + shiftFor(b)}px`,
                    top: `${b.y + 8}px`,
                    background: b.color,
                  }"
                  :title="b.card.title"
                  @click="emit('open-card', b.card.id)"
                  @pointerdown="startDrag(b, $event)"
                />
                <div
                  v-else
                  class="gantt__bar"
                  :class="{ 'gantt__bar--dragging': dragging?.bar.card.id === b.card.id }"
                  :style="{
                    left: `${b.x + shiftFor(b)}px`,
                    top: `${b.y + 6}px`,
                    width: `${b.width}px`,
                    background: b.color,
                  }"
                  @click="emit('open-card', b.card.id)"
                  @pointerdown="startDrag(b, $event)"
                >
                  <span class="gantt__bar-text">{{ b.card.title }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </v-card>

    <div v-else class="pa-10 text-center">
      <v-icon class="mb-2" color="grey" icon="mdi-chart-timeline" size="40" />
      <div class="text-body-2 text-medium-emphasis">
        No cards have both a start and a due date yet — the timeline plots that range.
      </div>
    </div>
  </div>
</template>

<script setup>
  import { computed, onBeforeUnmount, ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import { priorityMeta } from "@/lib/boards";

  /**
   * Cards with a start and a due date, as bars on a timeline. Dragging a
   * bar sideways shifts both dates by the same amount, which is how a
   * slipped task actually moves.
   */
  const emit = defineEmits(["open-card"]);

  const board = useBoard();
  const store = useStore();

  const ROW_H = 34;
  const LABEL_W = 190;

  const ZOOMS = [
    { label: "Day", dayWidth: 34 },
    { label: "Week", dayWidth: 12 },
    { label: "Month", dayWidth: 4 },
  ];
  const zoom = ref(1);
  const dayWidth = computed(() => ZOOMS[zoom.value].dayWidth);

  const scheduled = computed(() =>
    (board.board?.cards || [])
      .filter((c) => c.start_at && c.due_at && board.matches(c))
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at)),
  );

  const range = computed(() => {
    if (!scheduled.value.length) return null;
    const starts = scheduled.value.map((c) => new Date(c.start_at));
    const ends = scheduled.value.map((c) => new Date(c.due_at));
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 2);
    min.setHours(0, 0, 0, 0);
    return { min, max };
  });

  const dayOffset = (date) =>
    Math.round((new Date(date) - range.value.min) / 86400000);

  const totalDays = computed(() =>
    range.value ? dayOffset(range.value.max) + 1 : 0,
  );
  const chartWidth = computed(() => totalDays.value * dayWidth.value);

  const bars = computed(() =>
    scheduled.value.map((card, i) => {
      const start = dayOffset(card.start_at);
      const span = Math.max(1, dayOffset(card.due_at) - start + 1);
      const overdue = !card.due_complete && new Date(card.due_at) < new Date();
      return {
        card,
        x: start * dayWidth.value,
        y: i * ROW_H,
        width: span * dayWidth.value - 4,
        color: overdue
          ? "#C62828"
          : priorityMeta(card.priority)?.color || "#1867C0",
      };
    }),
  );

  /** Ticks thin out as the zoom widens, so labels never overlap. */
  const ticks = computed(() => {
    if (!range.value) return [];
    const step = dayWidth.value >= 30 ? 1 : dayWidth.value >= 10 ? 7 : 30;
    const out = [];
    for (let d = 0; d < totalDays.value; d += step) {
      const at = new Date(range.value.min);
      at.setDate(at.getDate() + d);
      out.push({
        x: d * dayWidth.value,
        strong: at.getDate() === 1,
        label: step === 1
          ? at.getDate()
          : at.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      });
    }
    return out;
  });

  const todayX = computed(() => {
    if (!range.value) return null;
    const offset = dayOffset(new Date());
    if (offset < 0 || offset > totalDays.value) return null;
    return offset * dayWidth.value;
  });

  // ── Dragging a bar to reschedule ────────────────────────────────
  const dragging = ref(null);

  const shiftFor = (b) =>
    dragging.value?.bar.card.id === b.card.id ? dragging.value.deltaX : 0;

  function startDrag(bar, event) {
    if (!board.canEdit) return;
    event.preventDefault();
    dragging.value = { bar, startX: event.clientX, deltaX: 0, moved: false };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd, { once: true });
  }

  function onDragMove(event) {
    if (!dragging.value) return;
    dragging.value.deltaX = event.clientX - dragging.value.startX;
    if (Math.abs(dragging.value.deltaX) > 3) dragging.value.moved = true;
  }

  async function onDragEnd() {
    window.removeEventListener("pointermove", onDragMove);
    const drag = dragging.value;
    dragging.value = null;
    if (!drag || !drag.moved) return;

    // Snap to whole days — a timeline that can land a task at 14:37
    // because of a few stray pixels is worse than one that cannot.
    const days = Math.round(drag.deltaX / dayWidth.value);
    if (!days) return;

    const card = drag.bar.card;
    const shiftBy = (iso) => {
      const d = new Date(iso);
      d.setDate(d.getDate() + days);
      return d.toISOString();
    };
    const previous = { start_at: card.start_at, due_at: card.due_at };
    const next = { start_at: shiftBy(card.start_at), due_at: shiftBy(card.due_at) };

    board.patchCard(card.id, next);
    try {
      await board.api.put(`/boards/cards/${card.id}`, next);
    } catch (err) {
      board.patchCard(card.id, previous);
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  onBeforeUnmount(() => window.removeEventListener("pointermove", onDragMove));
</script>

<style scoped>
.gantt {
  display: flex;
  user-select: none;
}
.gantt__labels {
  flex: 0 0 auto;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}
.gantt__head {
  height: 30px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  position: relative;
}
.gantt__label {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  font-size: 0.78rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}
.gantt__label:hover {
  color: rgb(var(--v-theme-primary));
}
.gantt__scroll {
  flex: 1 1 auto;
  overflow-x: auto;
}
.gantt__tick {
  position: absolute;
  top: 8px;
  font-size: 10px;
  color: rgba(0, 0, 0, 0.5);
  transform: translateX(2px);
  white-space: nowrap;
}
.gantt__tick--strong {
  font-weight: 700;
  color: rgba(0, 0, 0, 0.75);
}
.gantt__grid {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(0, 0, 0, 0.05);
}
.gantt__today {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgb(var(--v-theme-primary));
  opacity: 0.5;
}
.gantt__bar {
  position: absolute;
  height: 22px;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  padding: 2px 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: grab;
}
.gantt__bar--dragging {
  opacity: 0.75;
  cursor: grabbing;
}
.gantt__milestone {
  position: absolute;
  width: 16px;
  height: 16px;
  transform: rotate(45deg);
  border-radius: 3px;
  cursor: grab;
}
</style>
