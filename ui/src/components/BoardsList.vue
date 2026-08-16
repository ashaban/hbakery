<template>
  <v-container class="bg-grey-lighten-4 pa-6" fluid>
    <!-- HEADER -->
    <v-card class="mb-6" elevation="2">
      <v-card-text class="pa-6">
        <v-row align="center">
          <v-col cols="12" md="7">
            <div class="d-flex align-center">
              <v-avatar class="mr-4" color="primary" size="56">
                <v-icon color="white" size="32">mdi-view-column</v-icon>
              </v-avatar>
              <div>
                <h1 class="text-h4 font-weight-bold text-primary">Boards</h1>
                <p class="text-body-1 text-grey mt-1">
                  Track work — who is doing what, by when, and how far along.
                </p>
              </div>
            </div>
          </v-col>
          <v-col class="text-right" cols="12" md="5">
            <v-btn color="primary" @click="showNew = true">
              <v-icon start>mdi-plus</v-icon>
              New Board
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-progress-linear :active="loading" color="primary" height="4" :indeterminate="loading" />

    <div v-if="!loading && boards.length === 0" class="pa-12 text-center">
      <v-icon class="mb-4" color="grey-lighten-1" size="64">mdi-view-column-outline</v-icon>
      <div class="text-h6 text-grey">No boards yet</div>
      <div class="text-body-2 text-grey">Create one to start tracking work.</div>
    </div>

    <v-row v-else dense>
      <v-col v-for="b in boards" :key="b.id" cols="12" md="4" sm="6">
        <v-card class="rounded-lg" elevation="2" @click="openBoard(b)">
          <v-card-text class="pa-5">
            <div class="d-flex align-center mb-2">
              <v-icon class="mr-2" color="primary">mdi-view-column</v-icon>
              <div class="text-subtitle-1 font-weight-bold">{{ b.name }}</div>
              <v-spacer />
              <v-chip
                :color="b.visibility === 'ALL' ? 'success' : 'grey'"
                size="x-small"
                variant="flat"
              >
                {{ b.visibility === "ALL" ? "Everyone" : "Private" }}
              </v-chip>
            </div>
            <div v-if="b.description" class="text-body-2 text-grey mb-3">
              {{ b.description }}
            </div>
            <div class="text-caption text-grey">
              {{ b.card_count }} card{{ b.card_count === 1 ? "" : "s" }} ·
              {{ b.member_count }} member{{ b.member_count === 1 ? "" : "s" }}
              <v-chip v-if="b.my_role" class="ml-2" size="x-small" variant="tonal">
                {{ b.my_role }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- NEW BOARD DIALOG -->
    <v-dialog v-model="showNew" max-width="480">
      <v-card class="rounded-lg">
        <v-toolbar color="primary" density="comfortable">
          <v-avatar class="mr-3" color="primary" size="40">
            <v-icon color="white">mdi-view-column</v-icon>
          </v-avatar>
          <v-toolbar-title class="text-h6 font-weight-bold">New Board</v-toolbar-title>
          <v-spacer />
          <v-btn icon @click="showNew = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>
        <v-card-text class="pa-6">
          <v-text-field
            v-model="newBoard.name"
            density="comfortable"
            label="Board name"
            variant="outlined"
          />
          <v-textarea
            v-model="newBoard.description"
            density="comfortable"
            label="Description (optional)"
            rows="2"
            variant="outlined"
          />
          <v-select
            v-model="newBoard.visibility"
            density="comfortable"
            :items="[
              { title: 'Private — just invited members', value: 'PRIVATE' },
              { title: 'Everyone signed in', value: 'ALL' },
            ]"
            label="Who can see this board"
            variant="outlined"
          />
          <v-alert v-if="error" density="compact" type="error" variant="tonal">
            {{ error }}
          </v-alert>
        </v-card-text>
        <v-card-actions class="pa-4 bg-grey-lighten-4">
          <v-spacer />
          <v-btn size="large" variant="outlined" @click="showNew = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!newBoard.name.trim()"
            :loading="creating"
            size="large"
            variant="flat"
            @click="submitNew"
          >
            <v-icon start>mdi-check</v-icon>
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { onMounted, reactive, ref } from "vue";
  import { useRouter } from "vue-router";
  import { useStore } from "vuex";

  const store = useStore();
  const router = useRouter();

  const loading = ref(false);
  const boards = ref([]);
  const showNew = ref(false);
  const creating = ref(false);
  const error = ref("");
  const newBoard = reactive({ name: "", description: "", visibility: "PRIVATE" });

  async function loadBoards() {
    loading.value = true;
    try {
      const res = await fetch("/boards");
      const data = await res.json();
      boards.value = data.data || [];
    } catch {
      store.commit("setMessage", { type: "error", text: "Failed to load boards" });
    } finally {
      loading.value = false;
    }
  }

  function openBoard(board) {
    router.push({ name: "Board", query: { id: board.id } });
  }

  async function submitNew() {
    error.value = "";
    creating.value = true;
    try {
      const res = await fetch("/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBoard),
      });
      const data = await res.json();
      if (!res.ok) {
        error.value = data.error || "Failed to create board";
        return;
      }
      showNew.value = false;
      newBoard.name = "";
      newBoard.description = "";
      newBoard.visibility = "PRIVATE";
      openBoard(data);
    } catch {
      error.value = "Failed to create board";
    } finally {
      creating.value = false;
    }
  }

  onMounted(loadBoards);
</script>
