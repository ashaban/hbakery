<template>
  <div>
    <div v-if="totalCapacity" class="d-flex align-center ga-2 mb-4 text-body-2">
      <v-icon class="text-medium-emphasis" icon="mdi-scale-balance" size="18" />
      <span>
        <strong>{{ totalEstimated }}h</strong> of estimated work across
        <strong>{{ totalCapacity }}h</strong> of weekly capacity
      </span>
    </div>

    <div v-for="g in groups" :key="g.key" class="mb-5">
      <div class="d-flex align-center ga-3 mb-2">
        <StaffAvatar v-if="!g.unassigned" :name="g.name" :size="34" :tooltip="false" />
        <v-avatar v-else color="grey" size="34" variant="tonal">
          <v-icon icon="mdi-account-question-outline" size="18" />
        </v-avatar>

        <div class="flex-grow-1 min-w-0">
          <div class="text-body-2 font-weight-bold">{{ g.name }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ g.cards.length }} open
            <template v-if="!g.unassigned">
              · {{ hours(g.estimated) }}h of {{ g.capacity }}h
              <span v-if="g.unestimated">({{ g.unestimated }} not estimated)</span>
            </template>
            <span v-if="overdueCount(g.cards)" class="text-error">
              · {{ overdueCount(g.cards) }} overdue
            </span>
          </div>
        </div>

        <div v-if="!g.unassigned" style="width: 230px">
          <!-- Estimated hours against this person's weekly capacity. -->
          <v-progress-linear
            :color="g.over ? 'error' : overdueCount(g.cards) ? 'warning' : 'primary'"
            height="8"
            :model-value="g.load"
            rounded
          />
          <div class="d-flex align-center ga-1 mt-1">
            <span v-if="g.over" class="text-caption text-error font-weight-bold">
              Over capacity
            </span>
            <v-spacer />
            <template v-if="board.isOwner">
              <input
                v-if="editing === g.staffId"
                v-model="draftHours"
                autofocus
                class="cap-input"
                max="168"
                min="1"
                type="number"
                @blur="saveCapacity(g.staffId)"
                @keyup.enter="saveCapacity(g.staffId)"
              >
              <v-btn
                v-else
                size="x-small"
                variant="text"
                @click="editing = g.staffId; draftHours = g.capacity"
              >Set capacity</v-btn>
            </template>
          </div>
        </div>
        <v-progress-linear
          v-else
          color="grey"
          height="8"
          :model-value="(g.cards.length / busiest) * 100"
          rounded
          style="max-width: 230px"
        />
      </div>

      <div class="d-flex flex-wrap ga-2 ml-11">
        <div
          v-for="c in g.cards"
          :key="c.id"
          class="wl-card"
          @click="emit('open-card', c.id)"
        >
          <v-icon
            v-if="priorityMeta(c.priority)"
            :color="priorityMeta(c.priority).color"
            :icon="priorityMeta(c.priority).icon"
            size="11"
          />
          <span>{{ c.title }}</span>
          <v-chip
            v-if="c.due_at"
            :color="!c.due_complete && new Date(c.due_at) < new Date() ? 'error' : undefined"
            label
            size="x-small"
            variant="tonal"
          >{{ formatDate(c.due_at) }}</v-chip>
        </div>
        <div v-if="!g.cards.length" class="text-caption text-medium-emphasis">Nothing open.</div>
      </div>
    </div>

    <div v-if="!groups.length" class="pa-10 text-center">
      <v-icon class="mb-2" color="grey" icon="mdi-scale-balance" size="40" />
      <div class="text-body-2 text-medium-emphasis">
        Nobody has been added to this board yet.
      </div>
    </div>
  </div>
</template>

<script setup>
  import { computed, onMounted, ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { formatDate, priorityMeta } from "@/lib/boards";

  /**
   * Who is carrying what. This is the view that answers "is anyone
   * drowning?" — a question a board grouped by stage can never answer,
   * because one person's six cards look identical to six people's one
   * card each.
   */
  const emit = defineEmits(["open-card"]);

  const board = useBoard();
  const store = useStore();

  /**
   * Capacity turns this from "who has the most cards" into "who is over
   * their week" — a person with three week-long jobs is busier than one
   * with five ten-minute ones, and only estimated hours can say so.
   */
  const capacity = ref({ default_hours: 40, people: {} });
  const editing = ref(null);
  const draftHours = ref("");

  const capacityFor = (staffId) =>
    Number(capacity.value.people?.[staffId]?.hours ?? capacity.value.default_hours);

  const hours = (mins) => Number(((mins || 0) / 60).toFixed(1));

  async function loadCapacity() {
    try {
      capacity.value = await board.api.get(`/boards/${board.board.id}/capacity`);
    } catch {
      // The default keeps the bars meaningful.
    }
  }

  async function saveCapacity(staffId) {
    try {
      capacity.value = await board.api.put(`/boards/${board.board.id}/capacity/${staffId}`, {
        hours: draftHours.value === "" ? null : Number(draftHours.value),
      });
      editing.value = null;
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  const isDone = (c) => board.statusById[c.status_id]?.category === "DONE";

  const groups = computed(() => {
    const open = (board.board?.cards || []).filter((c) => board.matches(c) && !isDone(c));

    const rows = board.members.map((m) => {
      const cards = open.filter((c) => (c.member_ids || []).includes(m.staff_id));
      const estimated = cards.reduce((n, c) => n + (c.estimate_minutes || 0), 0);
      const cap = capacityFor(m.staff_id);
      return {
        key: m.staff_id,
        staffId: m.staff_id,
        name: m.full_name,
        cards,
        estimated,
        capacity: cap,
        // Cards with no estimate cannot be weighed, so the bar is honest
        // about covering only part of the load.
        unestimated: cards.filter((c) => !c.estimate_minutes).length,
        load: cap ? Math.min(200, (hours(estimated) / cap) * 100) : 0,
        over: cap > 0 && hours(estimated) > cap,
      };
    });

    const unassigned = open.filter((c) => !(c.member_ids || []).length);
    if (unassigned.length) {
      rows.push({ key: "none", name: "Nobody assigned", cards: unassigned, unassigned: true });
    }
    // Busiest first — the point of the view is to surface the overloaded.
    return rows.sort((a, b) => b.estimated - a.estimated || b.cards.length - a.cards.length);
  });

  const busiest = computed(() => Math.max(1, ...groups.value.map((g) => g.cards.length)));
  const totalCapacity = computed(() =>
    groups.value.filter((g) => !g.unassigned).reduce((n, g) => n + (g.capacity || 0), 0),
  );
  const totalEstimated = computed(() =>
    groups.value.reduce((n, g) => n + hours(g.estimated || 0), 0),
  );

  const overdueCount = (cards) =>
    cards.filter((c) => c.due_at && !c.due_complete && new Date(c.due_at) < new Date()).length;

  onMounted(loadCapacity);
</script>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.cap-input {
  width: 72px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 2px 6px;
  font: inherit;
  font-size: 0.8rem;
  color: inherit;
  background: transparent;
}
.wl-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 5px 9px;
  font-size: 0.8rem;
  cursor: pointer;
  max-width: 300px;
}
.wl-card:hover {
  border-color: rgb(var(--v-theme-primary));
}
.wl-card span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
