<template>
  <v-slide-y-reverse-transition>
    <div v-if="board.selecting" class="bulk">
      <v-chip color="primary" label size="small" variant="flat">
        {{ board.selected.length }} selected
      </v-chip>

      <v-menu location="top">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :disabled="busy"
            prepend-icon="mdi-account-outline"
            size="small"
            variant="tonal"
          >Assign</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="m in board.members"
            :key="m.staff_id"
            :title="m.full_name"
            @click="run('assign', m.staff_id, `assigned to ${m.full_name}`)"
          >
            <template #prepend>
              <StaffAvatar class="mr-2" :name="m.full_name" :size="24" :tooltip="false" />
            </template>
          </v-list-item>
          <v-divider />
          <v-list-subheader>Remove</v-list-subheader>
          <v-list-item
            v-for="m in board.members"
            :key="`u${m.staff_id}`"
            :title="m.full_name"
            @click="run('unassign', m.staff_id, `unassigned from ${m.full_name}`)"
          />
        </v-list>
      </v-menu>

      <v-menu location="top">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :disabled="busy"
            prepend-icon="mdi-label-outline"
            size="small"
            variant="tonal"
          >Label</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="l in board.labels"
            :key="l.id"
            :title="l.name || 'No name'"
            @click="run('label', l.id, 'labelled')"
          >
            <template #prepend>
              <span class="swatch mr-3" :style="{ background: l.color }" />
            </template>
          </v-list-item>
          <v-divider />
          <v-list-subheader>Remove</v-list-subheader>
          <v-list-item
            v-for="l in board.labels"
            :key="`u${l.id}`"
            :title="l.name || 'No name'"
            @click="run('unlabel', l.id, 'unlabelled')"
          />
        </v-list>
      </v-menu>

      <v-menu location="top">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :disabled="busy"
            prepend-icon="mdi-progress-check"
            size="small"
            variant="tonal"
          >Status</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="st in board.statuses"
            :key="st.id"
            :title="st.name"
            @click="run('status', st.id, `moved to ${st.name}`)"
          >
            <template #prepend>
              <span class="dot mr-3" :style="{ background: st.color }" />
            </template>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-menu location="top">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :disabled="busy"
            prepend-icon="mdi-flag-outline"
            size="small"
            variant="tonal"
          >Priority</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="p2 in PRIORITIES"
            :key="p2.value"
            :title="p2.label"
            @click="run('priority', p2.value, `set to ${p2.label}`)"
          >
            <template #prepend>
              <v-icon class="mr-3" :color="p2.color" :icon="p2.icon" size="16" />
            </template>
          </v-list-item>
          <v-list-item title="No priority" @click="run('priority', null, 'cleared of priority')" />
        </v-list>
      </v-menu>

      <v-menu :close-on-content-click="false" location="top">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :disabled="busy"
            prepend-icon="mdi-arrow-right"
            size="small"
            variant="tonal"
          >Move</v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="l in board.lists"
            :key="l.id"
            :title="l.name"
            @click="run('move', l.id, `moved to ${l.name}`)"
          />
        </v-list>
      </v-menu>

      <v-menu :close-on-content-click="false" location="top">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :disabled="busy"
            prepend-icon="mdi-clock-outline"
            size="small"
            variant="tonal"
          >Due</v-btn>
        </template>
        <v-card border class="pa-3" rounded="lg">
          <input v-model="dueDraft" class="due-input" type="datetime-local" @change="setDue(dueDraft)">
          <v-btn
            block
            class="mt-2"
            size="x-small"
            variant="text"
            @click="run('due', null, 'cleared of a due date')"
          >Clear due date</v-btn>
        </v-card>
      </v-menu>

      <v-btn
        color="error"
        :disabled="busy"
        prepend-icon="mdi-archive-outline"
        size="small"
        variant="tonal"
        @click="run('archive', null, 'archived')"
      >Archive</v-btn>

      <v-btn size="small" variant="text" @click="board.clearSelection">Cancel</v-btn>
    </div>
  </v-slide-y-reverse-transition>
</template>

<script setup>
  import { ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { PRIORITIES } from "@/lib/boards";

  /**
   * Acts on every ticked card at once. The case this exists for is
   * someone leaving and their fifteen cards needing a new owner — one at
   * a time is how that gets half-done.
   *
   * Anchored to the bottom of the screen so it is reachable no matter how
   * far down a long board the selection was made.
   */
  const board = useBoard();
  const store = useStore();

  const busy = ref(false);
  const dueDraft = ref("");

  async function run(action, value, describe) {
    busy.value = true;
    try {
      const count = await board.bulk(action, value);
      store.commit("setMessage", {
        type: "success",
        text: `${count} card${count === 1 ? "" : "s"} ${describe}`,
      });
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    } finally {
      busy.value = false;
    }
  }

  function setDue(local) {
    if (!local) return;
    run("due", new Date(local).toISOString(), "rescheduled");
    dueDraft.value = "";
  }
</script>

<style scoped>
.bulk {
  position: fixed;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  max-width: calc(100vw - 24px);
  padding: 10px 14px;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
}
.swatch {
  width: 30px;
  height: 15px;
  border-radius: 4px;
  display: inline-block;
}
.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}
.due-input {
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 7px;
  font: inherit;
  color: inherit;
  background: transparent;
}
</style>
