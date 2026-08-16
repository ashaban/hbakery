<template>
  <div>
    <div v-for="list in checklists" :key="list.id" class="mb-5">
      <div class="d-flex align-center ga-2 mb-1">
        <v-icon class="text-medium-emphasis" icon="mdi-checkbox-marked-outline" size="17" />
        <span class="text-body-2 font-weight-bold flex-grow-1">{{ list.name }}</span>
        <span class="text-caption text-medium-emphasis">
          {{ progress(list).done }}/{{ progress(list).total }}
        </span>
        <v-btn
          v-if="canEdit"
          icon="mdi-delete-outline"
          size="x-small"
          variant="text"
          @click="removeChecklist(list)"
        />
      </div>

      <v-progress-linear
        class="mb-2"
        :color="progress(list).percent === 100 ? 'success' : 'primary'"
        height="6"
        :model-value="progress(list).percent"
        rounded
      />

      <div v-for="item in list.items" :key="item.id" class="checklist-item">
        <v-checkbox-btn
          density="compact"
          :disabled="!canEdit"
          :model-value="item.is_done"
          @update:model-value="toggleItem(item)"
        />
        <div class="flex-grow-1 min-w-0">
          <div class="text-body-2" :class="{ 'checklist-item--done': item.is_done }">
            {{ item.content }}
          </div>
          <div v-if="item.assignee_id || item.due_at" class="d-flex align-center ga-2 mt-1">
            <StaffAvatar v-if="item.assignee_id" :name="item.assignee_name" :size="20" />
            <v-chip v-if="itemDue(item)" :color="itemDue(item).color" label size="x-small" variant="tonal">
              <v-icon icon="mdi-clock-outline" size="11" start />{{ itemDue(item).text }}
            </v-chip>
          </div>
        </div>

        <v-menu v-if="canEdit" :close-on-content-click="false" location="bottom end">
          <template #activator="{ props: p }">
            <v-btn v-bind="p" icon="mdi-dots-horizontal" size="x-small" variant="text" />
          </template>
          <v-card border min-width="240" rounded="lg">
            <v-list density="compact">
              <v-list-subheader>Assign this step</v-list-subheader>
              <v-list-item
                v-for="m in members"
                :key="m.staff_id"
                :title="m.full_name"
                @click="setItemAssignee(item, item.assignee_id === m.staff_id ? null : m.staff_id)"
              >
                <template #prepend>
                  <StaffAvatar class="mr-2" :name="m.full_name" :size="24" :tooltip="false" />
                </template>
                <template #append>
                  <v-icon
                    v-if="item.assignee_id === m.staff_id"
                    color="success"
                    icon="mdi-check"
                    size="16"
                  />
                </template>
              </v-list-item>
            </v-list>
            <v-divider />
            <div class="pa-3">
              <div class="text-caption text-medium-emphasis mb-2">Due</div>
              <input
                class="due-input"
                type="datetime-local"
                :value="toLocalInput(item.due_at)"
                @change="setItemDue(item, $event.target.value)"
              >
            </div>
            <v-divider />
            <v-list density="compact">
              <v-list-item
                base-color="error"
                prepend-icon="mdi-delete-outline"
                title="Delete step"
                @click="removeItem(item)"
              />
            </v-list>
          </v-card>
        </v-menu>
      </div>

      <div v-if="canEdit" class="ml-8 mt-1">
        <div v-if="addingItemTo === list.id" class="d-flex ga-2">
          <v-text-field
            v-model="newItem"
            autofocus
            density="compact"
            hide-details
            placeholder="Add a step"
            variant="outlined"
            @keyup.enter="addItem(list.id)"
            @keyup.esc="addingItemTo = null"
          />
          <v-btn color="primary" flat size="small" @click="addItem(list.id)">Add</v-btn>
        </div>
        <v-btn
          v-else
          prepend-icon="mdi-plus"
          size="small"
          variant="text"
          @click="addingItemTo = list.id; newItem = ''"
        >Add a step</v-btn>
      </div>
    </div>

    <div v-if="canEdit">
      <div v-if="addingList" class="d-flex ga-2">
        <v-text-field
          v-model="newListName"
          autofocus
          density="compact"
          hide-details
          placeholder="Checklist name"
          variant="outlined"
          @keyup.enter="addChecklist"
          @keyup.esc="addingList = false"
        />
        <v-btn color="primary" flat size="small" @click="addChecklist">Add</v-btn>
      </div>
      <v-btn
        v-else
        prepend-icon="mdi-checkbox-marked-outline"
        size="small"
        variant="tonal"
        @click="addingList = true"
      >Add a checklist</v-btn>
    </div>
  </div>
</template>

<script setup>
  import { ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { formatDate, toLocalInput } from "@/lib/boards";

  /**
   * A card's checklists. Items carry their own owner and deadline, which
   * is what separates a step someone is accountable for from a plain note.
   */
  const props = defineProps({
    cardId: { type: [String, Number], required: true },
    checklists: { type: Array, default: () => [] },
    members: { type: Array, default: () => [] },
    canEdit: { type: Boolean, default: false },
  });
  const emit = defineEmits(["changed"]);

  const board = useBoard();
  const store = useStore();

  const addingItemTo = ref(null);
  const newItem = ref("");
  const addingList = ref(false);
  const newListName = ref("");

  const progress = (list) => {
    const total = list.items.length;
    const done = list.items.filter((i) => i.is_done).length;
    return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  };

  /** Overdue steps are worth colouring; everything else stays quiet. */
  const itemDue = (item) => {
    if (!item.due_at) return null;
    const overdue = !item.is_done && new Date(item.due_at) < new Date();
    return { text: formatDate(item.due_at), color: overdue ? "error" : undefined };
  };

  async function run(fn) {
    try {
      await fn();
      emit("changed");
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  const addChecklist = () =>
    run(async () => {
      if (!newListName.value.trim()) return;
      await board.api.post(`/boards/cards/${props.cardId}/checklists`, {
        name: newListName.value.trim(),
      });
      newListName.value = "";
      addingList.value = false;
    });

  const addItem = (listId) =>
    run(async () => {
      if (!newItem.value.trim()) return;
      await board.api.post(`/boards/cards/${props.cardId}/checklists/${listId}/items`, {
        content: newItem.value.trim(),
      });
      newItem.value = "";
    });

  const toggleItem = (item) =>
    run(() =>
      board.api.put(`/boards/cards/${props.cardId}/checklist-items/${item.id}`, {
        is_done: !item.is_done,
      }),
    );

  const setItemAssignee = (item, assigneeId) =>
    run(() =>
      board.api.put(`/boards/cards/${props.cardId}/checklist-items/${item.id}`, {
        assignee_id: assigneeId,
      }),
    );

  const setItemDue = (item, local) =>
    run(() =>
      board.api.put(`/boards/cards/${props.cardId}/checklist-items/${item.id}`, {
        due_at: local ? new Date(local).toISOString() : null,
      }),
    );

  const removeItem = (item) =>
    run(() => board.api.del(`/boards/cards/${props.cardId}/checklist-items/${item.id}`));

  const removeChecklist = (list) =>
    run(() => board.api.del(`/boards/cards/${props.cardId}/checklists/${list.id}`));
</script>

<style scoped>
.checklist-item {
  display: flex;
  align-items: flex-start;
  gap: 2px;
  padding: 2px 0;
}
.checklist-item--done {
  text-decoration: line-through;
  opacity: 0.6;
}
.min-w-0 {
  min-width: 0;
}
.due-input {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 7px;
  font: inherit;
  color: inherit;
  background: transparent;
}
</style>
