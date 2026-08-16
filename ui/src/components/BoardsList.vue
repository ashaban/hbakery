<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div class="d-flex align-center flex-wrap ga-3 mb-5">
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold text-primary">Boards</h1>
        <div class="text-body-2 text-medium-emphasis">
          Track work — who is doing what, by when, and how far along.
        </div>
      </div>

      <v-text-field
        v-model="search"
        clearable
        density="compact"
        hide-details
        placeholder="Search all cards"
        prepend-inner-icon="mdi-magnify"
        style="max-width: 260px"
        variant="outlined"
        @keyup.enter="runSearch"
      />
      <v-btn
        :color="showArchived ? 'primary' : undefined"
        prepend-icon="mdi-archive-outline"
        :variant="showArchived ? 'flat' : 'text'"
        @click="toggleArchived"
      >
        Archived
      </v-btn>
      <v-btn color="primary" @click="showNew = true">
        <v-icon start>mdi-plus</v-icon>
        New Board
      </v-btn>
    </div>

    <!-- Cross-board search results -->
    <v-card v-if="results.length" class="mb-5" rounded="lg" variant="outlined">
      <v-card-title class="text-subtitle-2 py-3">
        {{ results.length }} card{{ results.length === 1 ? "" : "s" }} matching "{{ lastSearch }}"
        <v-btn class="float-right" size="x-small" variant="text" @click="results = []">Clear</v-btn>
      </v-card-title>
      <v-divider />
      <v-list density="compact">
        <v-list-item
          v-for="r in results"
          :key="r.id"
          :subtitle="`${r.board_name} · ${r.list_name}`"
          :title="r.title"
          @click="openCard(r)"
        />
      </v-list>
    </v-card>

    <v-progress-linear :active="loading" color="primary" height="4" indeterminate />

    <div v-if="!loading && boards.length === 0" class="pa-12 text-center">
      <v-icon class="mb-4" color="grey-lighten-1" size="64">mdi-view-column-outline</v-icon>
      <div class="text-h6 text-grey">
        {{ showArchived ? "No archived boards" : "No boards yet" }}
      </div>
      <div class="text-body-2 text-grey">
        {{ showArchived ? "" : "Create one to start tracking work." }}
      </div>
    </div>

    <v-row v-else dense>
      <v-col v-for="b in boards" :key="b.id" cols="12" md="4" sm="6">
        <v-card class="board-tile rounded-lg" variant="outlined" @click="openBoard(b)">
          <div class="board-tile__stripe" />
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-2">
              <div class="text-subtitle-1 font-weight-bold flex-grow-1 min-w-0 text-truncate">
                {{ b.name }}
              </div>
              <v-chip
                :color="b.visibility === 'ALL' ? 'success' : 'grey'"
                size="x-small"
                variant="tonal"
              >
                {{ b.visibility === "ALL" ? "Everyone" : "Private" }}
              </v-chip>
            </div>

            <div v-if="b.description" class="text-body-2 text-medium-emphasis mb-3 board-tile__desc">
              {{ b.description }}
            </div>

            <div class="d-flex align-center ga-2">
              <div class="d-flex">
                <StaffAvatar
                  v-for="m in (b.members || []).slice(0, 4)"
                  :key="m.staff_id"
                  :name="m.full_name"
                  :size="26"
                />
                <span
                  v-if="(b.members || []).length > 4"
                  class="text-caption text-medium-emphasis ml-1 align-self-center"
                >+{{ b.members.length - 4 }}</span>
              </div>
              <v-spacer />
              <span class="text-caption text-medium-emphasis">
                {{ b.card_count }} card{{ b.card_count === 1 ? "" : "s" }}
              </span>
              <v-chip v-if="b.my_card_count" color="primary" size="x-small" variant="tonal">
                {{ b.my_card_count }} mine
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- NEW BOARD -->
    <v-dialog v-model="showNew" max-width="480">
      <v-card border rounded="lg">
        <v-card-title class="py-4">New board</v-card-title>
        <v-divider />
        <v-card-text class="pt-5">
          <v-text-field v-model="newBoard.name" autofocus class="mb-2" label="Board name" />
          <v-textarea
            v-model="newBoard.description"
            class="mb-2"
            label="Description (optional)"
            rows="2"
          />
          <v-select
            v-model="newBoard.visibility"
            :items="[
              { title: 'Private — just the people I add', value: 'PRIVATE' },
              { title: 'Everyone signed in', value: 'ALL' },
            ]"
            label="Who can see this board"
          />
          <v-alert v-if="error" density="compact" type="error" variant="tonal">
            {{ error }}
          </v-alert>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="showNew = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!newBoard.name.trim()"
            flat
            :loading="creating"
            @click="submitNew"
          >Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { onMounted, reactive, ref } from "vue";
  import { useRouter } from "vue-router";
  import { useStore } from "vuex";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { useBoard } from "@/stores/board";

  const store = useStore();
  const router = useRouter();
  const board = useBoard();

  const loading = ref(false);
  const boards = ref([]);
  const showArchived = ref(false);
  const showNew = ref(false);
  const creating = ref(false);
  const error = ref("");
  const newBoard = reactive({ name: "", description: "", visibility: "PRIVATE" });

  const search = ref("");
  const lastSearch = ref("");
  const results = ref([]);

  async function loadBoards() {
    loading.value = true;
    try {
      boards.value = await board.api.get(`/boards?archived=${showArchived.value}`);
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    } finally {
      loading.value = false;
    }
  }

  function toggleArchived() {
    showArchived.value = !showArchived.value;
    loadBoards();
  }

  async function runSearch() {
    const term = (search.value || "").trim();
    if (!term) {
      results.value = [];
      return;
    }
    try {
      results.value = await board.api.get(`/boards/search?q=${encodeURIComponent(term)}`);
      lastSearch.value = term;
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  const openBoard = (b) => router.push({ name: "Board", query: { id: b.id } });
  const openCard = (r) => router.push({ name: "Board", query: { id: r.board_id, card: r.id } });

  async function submitNew() {
    error.value = "";
    creating.value = true;
    try {
      const created = await board.api.post("/boards", newBoard);
      showNew.value = false;
      newBoard.name = "";
      newBoard.description = "";
      newBoard.visibility = "PRIVATE";
      openBoard(created);
    } catch (err) {
      error.value = err.message;
    } finally {
      creating.value = false;
    }
  }

  onMounted(loadBoards);
</script>

<style scoped>
.board-tile {
  cursor: pointer;
  overflow: hidden;
}
.board-tile:hover {
  border-color: rgb(var(--v-theme-primary));
}
.board-tile__stripe {
  height: 6px;
  background: rgb(var(--v-theme-primary));
}
.board-tile__desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.min-w-0 {
  min-width: 0;
}
</style>
