<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <div v-if="!board" class="text-center py-12">
      <v-progress-circular color="primary" indeterminate />
    </div>

    <template v-else>
      <!-- HEADER -->
      <v-card class="mb-4" elevation="2">
        <v-card-text class="pa-4">
          <v-row align="center" no-gutters>
            <v-col cols="12" md="6">
              <div class="d-flex align-center">
                <v-btn icon size="small" variant="text" @click="$router.push({ name: 'BoardsList' })">
                  <v-icon>mdi-arrow-left</v-icon>
                </v-btn>
                <h1 class="text-h5 font-weight-bold text-primary ml-2">{{ board.name }}</h1>
                <v-chip class="ml-3" size="small" variant="tonal">{{ board.my_role }}</v-chip>
              </div>
            </v-col>
            <v-col class="text-right" cols="12" md="6">
              <v-btn variant="text" @click="showSettings = true">
                <v-icon start>mdi-cog</v-icon>
                Settings
              </v-btn>
            </v-col>
          </v-row>

          <v-tabs v-model="view" class="mt-2" density="compact">
            <v-tab value="kanban"><v-icon start>mdi-view-column</v-icon>Kanban</v-tab>
            <v-tab value="table"><v-icon start>mdi-table</v-icon>Table</v-tab>
            <v-tab value="calendar"><v-icon start>mdi-calendar-month</v-icon>Calendar</v-tab>
            <v-tab value="gantt"><v-icon start>mdi-chart-gantt</v-icon>Gantt</v-tab>
            <v-tab value="workload"><v-icon start>mdi-account-group</v-icon>Workload</v-tab>
            <v-tab value="time"><v-icon start>mdi-clock-outline</v-icon>Time</v-tab>
          </v-tabs>
        </v-card-text>
      </v-card>

      <!-- VIEWS -->
      <v-card class="rounded-lg pa-4" elevation="1">
        <v-progress-linear :active="loadingCards" color="primary" height="3" indeterminate />

        <KanbanView
          v-if="view === 'kanban'"
          :cards="cards"
          :lists="board.lists"
          @add-card="openAddCard"
          @add-list="addList"
          @move-card="moveCard"
          @open-card="openCard"
        />
        <TableView
          v-else-if="view === 'table'"
          :cards="cards"
          :lists="board.lists"
          :statuses="board.statuses"
          @open-card="openCard"
        />
        <CalendarView v-else-if="view === 'calendar'" :cards="cards" @open-card="openCard" />
        <GanttView v-else-if="view === 'gantt'" :cards="cards" @open-card="openCard" />
        <WorkloadView v-else-if="view === 'workload'" :board-id="board.id" />
        <TimeReportView v-else-if="view === 'time'" :board-id="board.id" />
      </v-card>
    </template>

    <!-- ADD CARD DIALOG -->
    <v-dialog v-model="showAddCard" max-width="420">
      <v-card class="rounded-lg">
        <v-card-title>New card</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newCardTitle"
            autofocus
            density="comfortable"
            label="Title"
            variant="outlined"
            @keyup.enter="submitAddCard"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="showAddCard = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!newCardTitle.trim()" variant="flat" @click="submitAddCard">
            Add
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ADD LIST DIALOG -->
    <v-dialog v-model="showAddList" max-width="420">
      <v-card class="rounded-lg">
        <v-card-title>New list</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newListName"
            autofocus
            density="comfortable"
            label="List name"
            variant="outlined"
            @keyup.enter="submitAddList"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="outlined" @click="showAddList = false">Cancel</v-btn>
          <v-btn color="primary" :disabled="!newListName.trim()" variant="flat" @click="submitAddList">
            Add
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <CardDialog
      :board-id="board?.id"
      :board-labels="board?.labels || []"
      :card-id="openCardId"
      :cards="cards"
      :statuses="board?.statuses || []"
      @changed="loadCards"
      @close="openCardId = null"
    />

    <BoardSettingsDialog v-model="showSettings" :board="board" @changed="loadBoard" />
  </v-container>
</template>

<script setup>
  import { onMounted, ref, watch } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { useStore } from "vuex";
  import KanbanView from "@/components/board/KanbanView.vue";
  import TableView from "@/components/board/TableView.vue";
  import CalendarView from "@/components/board/CalendarView.vue";
  import GanttView from "@/components/board/GanttView.vue";
  import WorkloadView from "@/components/board/WorkloadView.vue";
  import TimeReportView from "@/components/board/TimeReportView.vue";
  import CardDialog from "@/components/board/CardDialog.vue";
  import BoardSettingsDialog from "@/components/settings/BoardSettingsDialog.vue";

  const route = useRoute();
  const router = useRouter();
  const store = useStore();

  const board = ref(null);
  const cards = ref([]);
  const loadingCards = ref(false);
  const view = ref("kanban");
  const openCardId = ref(null);
  const showSettings = ref(false);

  const showAddCard = ref(false);
  const addCardListId = ref(null);
  const newCardTitle = ref("");

  const showAddList = ref(false);
  const newListName = ref("");

  async function loadBoard() {
    const res = await fetch(`/boards/${route.query.id}`);
    if (!res.ok) {
      store.commit("setMessage", { type: "error", text: "Failed to load board" });
      router.push({ name: "BoardsList" });
      return;
    }
    board.value = await res.json();
  }

  async function loadCards() {
    loadingCards.value = true;
    try {
      const res = await fetch(`/boards/${route.query.id}/cards`);
      const data = await res.json();
      cards.value = data.data || [];
    } finally {
      loadingCards.value = false;
    }
  }

  function openCard(id) {
    openCardId.value = id;
  }

  function openAddCard(listId) {
    addCardListId.value = listId;
    newCardTitle.value = "";
    showAddCard.value = true;
  }

  async function submitAddCard() {
    if (!newCardTitle.value.trim()) return;
    await fetch(`/boards/${board.value.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id: addCardListId.value, title: newCardTitle.value.trim() }),
    });
    showAddCard.value = false;
    await loadCards();
  }

  function addList() {
    newListName.value = "";
    showAddList.value = true;
  }

  async function submitAddList() {
    if (!newListName.value.trim()) return;
    await fetch(`/boards/${board.value.id}/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newListName.value.trim() }),
    });
    showAddList.value = false;
    await loadBoard();
  }

  async function moveCard({ cardId, list_id, before_id, after_id }) {
    // Optimistic: the drag has already visually reordered `cards` via
    // vuedraggable's v-model-less list mutation, so just persist it —
    // reloading here would fight the drop animation.
    await fetch(`/boards/cards/${cardId}/move`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ list_id, before_id, after_id }),
    });
    await loadCards();
  }

  watch(
    () => route.query.id,
    () => {
      if (route.query.id) {
        loadBoard();
        loadCards();
      }
    },
  );

  onMounted(() => {
    loadBoard();
    loadCards();
  });
</script>
