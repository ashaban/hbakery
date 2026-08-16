<template>
  <div>
    <div v-if="recurrence && !editing" class="d-flex align-center ga-2">
      <v-icon color="primary" icon="mdi-repeat" size="16" />
      <div class="flex-grow-1">
        <div class="text-body-2">{{ summary }}</div>
        <div class="text-caption text-medium-emphasis">
          Next on {{ formatDate(recurrence.next_run_at) }}
          <span v-if="recurrence.ends_at"> · until {{ formatDate(recurrence.ends_at) }}</span>
        </div>
      </div>
      <v-btn v-if="canEdit" size="x-small" variant="text" @click="editing = true">Change</v-btn>
      <v-btn v-if="canEdit" color="error" size="x-small" variant="text" @click="remove">Stop</v-btn>
    </div>

    <div v-else-if="editing">
      <v-select
        v-model="draft.freq"
        class="mb-2"
        density="compact"
        hide-details
        item-title="title"
        item-value="value"
        :items="FREQS"
        label="Repeat"
      />
      <div class="d-flex align-center ga-2 mb-2">
        <span class="text-caption text-medium-emphasis">Every</span>
        <input v-model="draft.interval" class="mini-input" min="1" type="number">
        <span class="text-caption text-medium-emphasis">
          {{ FREQS.find((f) => f.value === draft.freq)?.title.toLowerCase().replace("ly", "") }}(s)
        </span>
      </div>

      <div v-if="draft.freq === 'WEEKLY'" class="d-flex flex-wrap ga-1 mb-2">
        <v-chip
          v-for="d in WEEKDAYS"
          :key="d.value"
          :color="draft.weekdays.includes(d.value) ? 'primary' : undefined"
          label
          size="small"
          :variant="draft.weekdays.includes(d.value) ? 'flat' : 'tonal'"
          @click="toggleDay(d.value)"
        >{{ d.label }}</v-chip>
      </div>

      <div v-if="draft.freq === 'MONTHLY'" class="d-flex align-center ga-2 mb-2">
        <span class="text-caption text-medium-emphasis">On day</span>
        <input v-model="draft.day_of_month" class="mini-input" max="31" min="1" type="number">
        <span class="text-caption text-medium-emphasis">(a short month uses its last day)</span>
      </div>

      <div class="d-flex align-center ga-2 mb-2">
        <span class="text-caption text-medium-emphasis">Until</span>
        <input v-model="draft.ends_at" class="mini-input" style="width: 150px" type="date">
      </div>

      <div class="d-flex ga-2">
        <v-btn color="primary" flat size="small" @click="save">Save</v-btn>
        <v-btn size="small" variant="text" @click="editing = false">Cancel</v-btn>
      </div>
    </div>

    <v-btn
      v-else-if="canEdit"
      prepend-icon="mdi-repeat"
      size="small"
      variant="tonal"
      @click="editing = true"
    >Make this repeat</v-btn>

    <div v-else class="text-caption text-medium-emphasis">Does not repeat.</div>
  </div>
</template>

<script setup>
  import { computed, ref, watch } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import { formatDate } from "@/lib/boards";

  /**
   * Makes a card repeat. When it fires, a fresh copy is created — the
   * point of a repeat is the work, not its history.
   */
  const props = defineProps({
    cardId: { type: [String, Number], required: true },
    recurrence: { type: Object, default: null },
    canEdit: { type: Boolean, default: false },
  });
  const emit = defineEmits(["changed"]);

  const board = useBoard();
  const store = useStore();

  const FREQS = [
    { value: "DAILY", title: "Daily" },
    { value: "WEEKLY", title: "Weekly" },
    { value: "MONTHLY", title: "Monthly" },
    { value: "QUARTERLY", title: "Quarterly" },
    { value: "YEARLY", title: "Yearly" },
  ];

  const WEEKDAYS = [
    { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
    { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" },
    { value: 7, label: "Sun" },
  ];

  const editing = ref(false);
  const draft = ref(blank());

  function blank() {
    return { freq: "MONTHLY", interval: 1, weekdays: [], day_of_month: null, ends_at: null };
  }

  watch(
    () => props.recurrence,
    (r) => {
      draft.value = r
        ? {
            freq: r.freq,
            interval: r.interval,
            weekdays: r.weekdays || [],
            day_of_month: r.day_of_month,
            ends_at: r.ends_at ? String(r.ends_at).slice(0, 10) : null,
          }
        : blank();
    },
    { immediate: true },
  );

  const summary = computed(() => {
    const r = props.recurrence;
    if (!r) return null;
    const every = r.interval > 1 ? `every ${r.interval} ` : "every ";
    const unit = {
      DAILY: "day", WEEKLY: "week", MONTHLY: "month",
      QUARTERLY: "quarter", YEARLY: "year",
    }[r.freq];
    const days = r.freq === "WEEKLY" && r.weekdays?.length
      ? ` on ${r.weekdays.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join(", ")}`
      : "";
    const day = r.freq === "MONTHLY" && r.day_of_month ? ` on day ${r.day_of_month}` : "";
    return `Repeats ${every}${unit}${r.interval > 1 ? "s" : ""}${days}${day}`;
  });

  const toggleDay = (d) => {
    draft.value.weekdays = draft.value.weekdays.includes(d)
      ? draft.value.weekdays.filter((x) => x !== d)
      : [...draft.value.weekdays, d].sort((a, b) => a - b);
  };

  async function save() {
    try {
      await board.api.put(`/boards/cards/${props.cardId}/recurrence`, {
        freq: draft.value.freq,
        interval: Number(draft.value.interval) || 1,
        weekdays: draft.value.freq === "WEEKLY" ? draft.value.weekdays : null,
        day_of_month: draft.value.freq === "MONTHLY" ? draft.value.day_of_month : null,
        ends_at: draft.value.ends_at || null,
      });
      editing.value = false;
      emit("changed");
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  async function remove() {
    try {
      await board.api.del(`/boards/cards/${props.cardId}/recurrence`);
      editing.value = false;
      emit("changed");
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }
</script>

<style scoped>
.mini-input {
  width: 80px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 6px 8px;
  font: inherit;
  color: inherit;
  background: transparent;
}
</style>
