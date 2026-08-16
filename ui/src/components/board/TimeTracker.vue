<template>
  <div>
    <div class="d-flex align-center flex-wrap ga-3 mb-3">
      <div>
        <div class="text-caption text-medium-emphasis">Estimate</div>
        <div v-if="editingEstimate" class="d-flex ga-1 align-center">
          <input
            v-model="estimateDraft"
            autofocus
            class="mini-input"
            min="0"
            placeholder="minutes"
            type="number"
            @keyup.enter="saveEstimate"
          >
          <v-btn color="primary" flat size="x-small" @click="saveEstimate">Save</v-btn>
        </div>
        <div
          v-else
          class="text-body-2"
          :class="{ 'cursor-text': canEdit }"
          @click="canEdit && ((editingEstimate = true), (estimateDraft = estimate ?? ''))"
        >{{ estimate ? hhmm(estimate) : "—" }}</div>
      </div>

      <div>
        <div class="text-caption text-medium-emphasis">Logged</div>
        <div class="text-body-2" :class="{ 'text-error font-weight-bold': overrun }">
          {{ hhmm(time.logged_minutes) }}
        </div>
      </div>

      <v-spacer />

      <v-btn
        v-if="canEdit && !running"
        color="primary"
        prepend-icon="mdi-play"
        size="small"
        variant="tonal"
        @click="start"
      >Start timer</v-btn>
      <v-btn
        v-else-if="canEdit && running"
        color="error"
        prepend-icon="mdi-stop"
        size="small"
        variant="tonal"
        @click="stop"
      >Stop · {{ elapsed }}</v-btn>
      <v-btn
        v-if="canEdit"
        prepend-icon="mdi-plus"
        size="small"
        variant="text"
        @click="addingManual = !addingManual"
      >Log time</v-btn>
    </div>

    <v-progress-linear
      v-if="estimate"
      class="mb-3"
      :color="overrun ? 'error' : 'primary'"
      height="6"
      :model-value="Math.min(100, (time.logged_minutes / estimate) * 100)"
      rounded
    />

    <div v-if="addingManual" class="d-flex ga-2 mb-3">
      <input v-model="manual.minutes" class="mini-input" min="1" placeholder="minutes" type="number">
      <v-text-field
        v-model="manual.note"
        density="compact"
        hide-details
        placeholder="What was done?"
      />
      <v-btn color="primary" flat size="small" @click="addManual">Add</v-btn>
    </div>

    <div v-for="e in time.entries" :key="e.id" class="entry">
      <StaffAvatar :name="e.staff_name" :size="22" />
      <span class="text-body-2">{{ e.ended_at ? hhmm(e.minutes) : "running…" }}</span>
      <span v-if="e.note" class="text-caption text-medium-emphasis">{{ e.note }}</span>
      <span class="text-caption text-medium-emphasis">{{ relativeTime(e.started_at) }}</span>
      <v-spacer />
      <v-btn
        v-if="e.staff_id === board.viewerId && e.ended_at"
        icon="mdi-close"
        size="x-small"
        variant="text"
        @click="removeEntry(e)"
      />
    </div>

    <div v-if="!time.entries.length" class="text-caption text-medium-emphasis">
      No time logged yet.
    </div>
  </div>
</template>

<script setup>
  import { computed, onBeforeUnmount, onMounted, ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { hhmm, relativeTime } from "@/lib/boards";

  /**
   * Estimated versus actual effort. The timer is server-side — the entry
   * is open until it is stopped — so closing the tab or moving to another
   * machine does not lose the running clock.
   */
  const props = defineProps({
    cardId: { type: [String, Number], required: true },
    estimate: { type: Number, default: null },
    time: {
      type: Object,
      default: () => ({ entries: [], logged_minutes: 0, running: null }),
    },
    canEdit: { type: Boolean, default: false },
  });
  const emit = defineEmits(["changed"]);

  const board = useBoard();
  const store = useStore();

  const editingEstimate = ref(false);
  const estimateDraft = ref("");
  const manual = ref({ minutes: "", note: "" });
  const addingManual = ref(false);

  // Re-rendered every second only while a timer is actually running.
  const now = ref(Date.now());
  let ticker = null;

  const running = computed(() => props.time?.running || null);

  const elapsed = computed(() => {
    if (!running.value) return "";
    const secs = Math.max(
      0,
      Math.floor((now.value - new Date(running.value.started_at)) / 1000),
    );
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  });

  /** Over the estimate is worth flagging; under it is not. */
  const overrun = computed(() => props.estimate && props.time.logged_minutes > props.estimate);

  async function run(fn) {
    try {
      await fn();
      emit("changed");
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  const start = () => run(() => board.api.post(`/boards/cards/${props.cardId}/time/start`));
  const stop = () => run(() => board.api.post(`/boards/cards/${props.cardId}/time/stop`));

  const saveEstimate = () =>
    run(async () => {
      await board.api.put(`/boards/cards/${props.cardId}/estimate`, {
        minutes: estimateDraft.value === "" ? null : Number(estimateDraft.value),
      });
      editingEstimate.value = false;
    });

  const addManual = () =>
    run(async () => {
      if (!Number(manual.value.minutes)) return;
      await board.api.post(`/boards/cards/${props.cardId}/time`, {
        minutes: Number(manual.value.minutes),
        note: manual.value.note || null,
      });
      manual.value = { minutes: "", note: "" };
      addingManual.value = false;
    });

  const removeEntry = (e) =>
    run(() => board.api.del(`/boards/cards/${props.cardId}/time/${e.id}`));

  onMounted(() => {
    ticker = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  });
  onBeforeUnmount(() => clearInterval(ticker));
</script>

<style scoped>
.cursor-text {
  cursor: text;
}
.mini-input {
  width: 92px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  background: transparent;
}
.entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
</style>
