<template>
  <!--
    force-fallback turns off native HTML5 drag-and-drop in favour of
    Sortable's own pointer implementation. Native DnD is unreliable on
    touch devices, which is how a lot of this system is used, and it gives
    a drag mirror that can actually be styled.
  -->
  <draggable
    class="kanban"
    :disabled="!board.canEdit || board.groupBy !== 'list'"
    fallback-class="kanban__mirror"
    :fallback-tolerance="3"
    :force-fallback="true"
    ghost-class="kanban__ghost"
    handle=".kanban__grip"
    item-key="key"
    :model-value="board.columns"
    @change="onListDrop"
  >
    <template #item="{ element: list }">
      <div
        class="kanban__list"
        :class="{ 'kanban__list--collapsed': board.isCollapsed(list.key) }"
        :style="list.color ? { borderTopColor: list.color, borderTopWidth: '3px' } : {}"
      >
        <div class="kanban__head">
          <v-icon
            v-if="board.canEdit && board.groupBy === 'list'"
            class="kanban__grip text-medium-emphasis"
            icon="mdi-drag-horizontal-variant"
            size="16"
          />
          <input
            v-if="renaming === list.key"
            v-model="renameValue"
            class="kanban__rename"
            @blur="submitRename(list)"
            @keyup.enter="submitRename(list)"
            @keyup.esc="renaming = null"
          >
          <span
            v-else
            class="kanban__title"
            :class="{ 'kanban__title--editable': board.canEdit && board.groupBy === 'list' }"
            @click="board.canEdit && board.groupBy === 'list' && startRename(list)"
          >{{ list.name }}</span>

          <span class="kanban__count">{{ countLabel(list) }}</span>

          <v-btn
            v-if="board.canEdit && board.selecting"
            icon="mdi-select-all"
            size="x-small"
            title="Select or clear every card in this column"
            variant="text"
            @click="board.selectAllIn(list)"
          />

          <v-btn
            :icon="board.isCollapsed(list.key) ? 'mdi-chevron-right' : 'mdi-chevron-down'"
            size="x-small"
            :title="board.isCollapsed(list.key) ? 'Expand' : 'Collapse'"
            variant="text"
            @click="board.toggleCollapsed(list.key)"
          />

          <v-menu
            v-if="board.canEdit && board.groupBy === 'list'"
            :close-on-content-click="false"
            location="bottom end"
          >
            <template #activator="{ props: p }">
              <v-btn v-bind="p" icon="mdi-dots-horizontal" size="x-small" variant="text" />
            </template>
            <v-card border min-width="230" rounded="lg">
              <v-list density="compact">
                <v-list-item prepend-icon="mdi-plus" title="Add a card" @click="startAdd(list.id)" />
                <v-list-item
                  prepend-icon="mdi-pencil-outline"
                  title="Rename"
                  @click="startRename(list)"
                />
              </v-list>
              <v-divider />
              <div class="pa-3">
                <div class="text-caption text-medium-emphasis mb-2">List colour</div>
                <div class="d-flex flex-wrap ga-1">
                  <button
                    v-for="c in LIST_COLORS"
                    :key="c || 'none'"
                    class="list-swatch"
                    :class="{ 'list-swatch--on': list.color === c, 'list-swatch--none': !c }"
                    :style="c ? { background: c } : {}"
                    @click="setColor(list, c)"
                  />
                </div>
              </div>
              <v-divider />
              <v-list density="compact">
                <v-list-item
                  base-color="error"
                  prepend-icon="mdi-archive-outline"
                  title="Archive this list"
                  @click="archiveList(list)"
                />
              </v-list>
            </v-card>
          </v-menu>
        </div>

        <draggable
          v-show="!board.isCollapsed(list.key)"
          animation="150"
          class="kanban__cards"
          :disabled="!board.canEdit || !board.canReorder"
          fallback-class="kanban__mirror"
          :fallback-tolerance="3"
          :force-fallback="true"
          ghost-class="kanban__ghost"
          group="cards"
          item-key="id"
          :model-value="board.cardsInColumn(list)"
          :scroll-sensitivity="90"
          :scroll-speed="14"
          @change="onCardDrop(list.id, $event)"
        >
          <template #item="{ element: card }">
            <div>
              <BoardCardTile :card="card" @click="emit('open-card', card.id)" />
            </div>
          </template>
        </draggable>

        <div v-if="addingTo === list.id && !board.isCollapsed(list.key)" class="pa-2 pt-0">
          <v-textarea
            ref="titleField"
            v-model="newTitle"
            auto-grow
            autofocus
            density="compact"
            hide-details
            placeholder="Card title — Enter to add, Esc to close"
            rows="2"
            variant="outlined"
            @keydown.enter.prevent="submitCard(list.id)"
            @keyup.esc="addingTo = null"
          />
          <div class="d-flex ga-2 mt-2">
            <v-btn color="primary" flat size="small" @click="submitCard(list.id)">Add card</v-btn>
            <v-btn size="small" variant="text" @click="addingTo = null">Cancel</v-btn>
          </div>
        </div>
        <v-btn
          v-else-if="board.canEdit && board.groupBy === 'list' && !board.isCollapsed(list.key)"
          block
          class="justify-start kanban__add"
          prepend-icon="mdi-plus"
          size="small"
          variant="text"
          @click="startAdd(list.id)"
        >
          Add a card
        </v-btn>
      </div>
    </template>

    <template #footer>
      <div v-if="board.groupBy === 'list'" class="kanban__list kanban__list--new">
        <div v-if="addingList" class="pa-2">
          <v-text-field
            v-model="newListName"
            autofocus
            density="compact"
            hide-details
            placeholder="List name"
            variant="outlined"
            @keyup.enter="submitList"
            @keyup.esc="addingList = false"
          />
          <div class="d-flex ga-2 mt-2">
            <v-btn color="primary" flat size="small" @click="submitList">Add list</v-btn>
            <v-btn size="small" variant="text" @click="addingList = false">Cancel</v-btn>
          </div>
        </div>
        <v-btn
          v-else-if="board.canEdit"
          block
          class="justify-start"
          prepend-icon="mdi-plus"
          variant="text"
          @click="addingList = true"
        >
          Add another list
        </v-btn>
      </div>
    </template>
  </draggable>
</template>

<script setup>
  import { nextTick, ref } from "vue";
  import draggable from "vuedraggable";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import BoardCardTile from "./BoardCardTile.vue";
  import { LIST_COLORS } from "@/lib/boards";

  const emit = defineEmits(["open-card"]);

  const board = useBoard();
  const store = useStore();

  const fail = (err) =>
    store.commit("setMessage", { type: "error", text: err.message || "Something went wrong" });

  const addingTo = ref(null);
  const newTitle = ref("");
  const titleField = ref(null);

  const addingList = ref(false);
  const newListName = ref("");

  const renaming = ref(null);
  const renameValue = ref("");

  /** "3 of 11" while a filter is hiding cards, otherwise just the count. */
  function countLabel(column) {
    const shown = board.cardsInColumn(column).length;
    if (board.groupBy !== "list") return String(shown);
    const total = board.totalIn(column.id);
    return board.filterActive && shown !== total ? `${shown} of ${total}` : String(total);
  }

  async function setColor(list, color) {
    try {
      await board.setListColor(list.id, color);
    } catch (err) {
      fail(err);
    }
  }

  async function startAdd(listId) {
    addingTo.value = listId;
    newTitle.value = "";
    await nextTick();
    titleField.value?.focus?.();
  }

  async function submitCard(listId) {
    const title = newTitle.value.trim();
    if (!title) {
      addingTo.value = null;
      return;
    }
    try {
      await board.addCard(listId, title);
      // Stay open so several cards can be typed in a row, as Trello does.
      newTitle.value = "";
      await nextTick();
      titleField.value?.focus?.();
    } catch (err) {
      fail(err);
    }
  }

  async function submitList() {
    const name = newListName.value.trim();
    if (!name) {
      addingList.value = false;
      return;
    }
    try {
      await board.addList(name);
      newListName.value = "";
      addingList.value = false;
    } catch (err) {
      fail(err);
    }
  }

  function startRename(list) {
    renaming.value = list.key;
    renameValue.value = list.name;
  }

  async function submitRename(list) {
    const name = renameValue.value.trim();
    renaming.value = null;
    if (!name || name === list.name) return;
    try {
      await board.renameList(list.id, name);
    } catch (err) {
      fail(err);
    }
  }

  async function archiveList(list) {
    try {
      await board.archiveList(list.id);
    } catch (err) {
      fail(err);
    }
  }

  /**
   * vuedraggable reports the drop as {added|moved}. Either way the store
   * is told which list and which index, and works out the neighbours.
   */
  async function onCardDrop(listId, event) {
    const change = event.added || event.moved;
    if (!change) return;
    try {
      await board.moveCard(change.element.id, listId, change.newIndex);
    } catch (err) {
      fail(err);
    }
  }

  async function onListDrop(event) {
    const change = event.moved;
    if (!change) return;
    try {
      await board.moveList(change.element.id, change.newIndex);
    } catch (err) {
      fail(err);
    }
  }
</script>

<style scoped>
/* The board scrolls sideways as a whole; each list scrolls on its own. */
.kanban {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 4px 16px;
  min-height: 60vh;
  /* Sortable's fallback drag would otherwise smear a text selection
     across every card the pointer passes over. */
  user-select: none;
}
.kanban input,
.kanban textarea {
  user-select: text;
}
.kanban__list {
  flex: 0 0 288px;
  width: 288px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  max-height: calc(100vh - 300px);
  display: flex;
  flex-direction: column;
}
.kanban__list--new {
  background: transparent;
  border-style: dashed;
}
/* A collapsed list keeps only its header, so a long board stays scannable. */
.kanban__list--collapsed {
  flex: 0 0 200px;
  width: 200px;
}
.kanban__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px 6px 12px;
}
.kanban__grip {
  cursor: grab;
}
.kanban__title {
  font-size: 0.86rem;
  font-weight: 700;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kanban__title--editable {
  cursor: text;
}
.kanban__rename {
  flex: 1;
  min-width: 0;
  font-size: 0.86rem;
  font-weight: 700;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 6px;
  padding: 2px 6px;
  background: rgb(var(--v-theme-surface));
  color: inherit;
}
.kanban__count {
  font-size: 0.72rem;
  color: rgba(0, 0, 0, 0.6);
  min-width: 18px;
  text-align: center;
}
.kanban__cards {
  padding: 4px 8px 0;
  overflow-y: auto;
  flex: 1;
  /* An empty list still needs a target big enough to drop a card onto. */
  min-height: 44px;
}
.kanban__add {
  margin: 0 4px 6px;
}
/* The gap left behind by the card being dragged. */
.kanban__ghost {
  opacity: 0.35;
}
/* The card that follows the pointer. */
.kanban__mirror {
  transform: rotate(3deg);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
  cursor: grabbing;
}
.list-swatch {
  width: 30px;
  height: 22px;
  border-radius: 5px;
  border: 2px solid transparent;
  cursor: pointer;
}
.list-swatch--on {
  border-color: rgba(0, 0, 0, 0.8);
}
.list-swatch--none {
  background: repeating-linear-gradient(45deg, #ddd 0 5px, #fff 5px 10px);
}
</style>
