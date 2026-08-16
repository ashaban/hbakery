<template>
  <v-container class="pa-4 pa-md-6" fluid>
    <div v-if="board.loading" class="d-flex justify-center py-16">
      <v-progress-circular color="primary" indeterminate size="42" />
    </div>

    <template v-else-if="board.board">
      <div class="d-flex align-center flex-wrap ga-3 mb-4">
        <v-btn icon="mdi-arrow-left" variant="text" @click="$router.push({ name: 'BoardsList' })" />
        <div class="flex-grow-1 min-w-0">
          <h1 class="text-h5 font-weight-bold text-primary">{{ board.board.name }}</h1>
          <div v-if="board.board.description" class="text-body-2 text-medium-emphasis">
            {{ board.board.description }}
          </div>
        </div>

        <div class="d-flex align-center ga-1">
          <StaffAvatar
            v-for="m in board.members.slice(0, 6)"
            :key="m.staff_id"
            :name="m.full_name"
            :size="30"
          />
          <span v-if="board.members.length > 6" class="text-caption text-medium-emphasis ml-1">
            +{{ board.members.length - 6 }}
          </span>
        </div>

        <v-btn-toggle v-model="view" density="compact" divided mandatory variant="outlined">
          <v-btn v-for="v in VIEWS" :key="v.value" size="small" :value="v.value">
            <v-icon :icon="v.icon" size="18" />
            <v-tooltip activator="parent" location="bottom">{{ v.label }}</v-tooltip>
          </v-btn>
        </v-btn-toggle>

        <v-btn prepend-icon="mdi-account-multiple-outline" variant="text" @click="openMembers">
          Members
        </v-btn>
        <v-menu location="bottom end">
          <template #activator="{ props: p }">
            <v-btn v-bind="p" icon="mdi-dots-vertical" variant="text" />
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-archive-arrow-up-outline"
              title="Archived items"
              @click="archiveDialog = true"
            />
            <v-list-item
              v-if="board.isOwner"
              prepend-icon="mdi-tag-multiple-outline"
              title="Manage statuses"
              @click="statusesDialog = true"
            />
            <v-list-item
              v-if="board.isOwner"
              prepend-icon="mdi-clipboard-text-outline"
              title="Intake forms"
              @click="formsDialog = true"
            />
            <template v-if="board.isOwner">
              <v-divider />
              <v-list-item
                base-color="error"
                prepend-icon="mdi-archive-outline"
                title="Archive this board"
                @click="archiveBoard"
              />
            </template>
          </v-list>
        </v-menu>
      </div>

      <v-alert
        v-if="board.board.linked_card"
        class="mb-4"
        density="comfortable"
        icon="mdi-link-variant"
        rounded="lg"
        type="info"
        variant="tonal"
      >
        This board addresses
        <router-link
          class="font-weight-bold"
          :to="{ name: 'Board', query: { id: board.board.linked_card.board_id, card: board.board.linked_card.id } }"
        >{{ board.board.linked_card.title }}</router-link>
        on <strong>{{ board.board.linked_card.board_name }}</strong>.
      </v-alert>

      <BoardFilterBar v-model="board.state.filter" />
      <BoardViewBar v-model:view-type="view" />

      <BoardKanban v-if="view === 'board'" @open-card="openCard" />
      <BoardCalendar v-else-if="view === 'calendar'" @open-card="openCard" />
      <BoardTable v-else-if="view === 'table'" @open-card="openCard" />
      <BoardGantt v-else-if="view === 'gantt'" @open-card="openCard" />
      <BoardWorkload v-else @open-card="openCard" />

      <!-- Outside the view chain: the bulk bar floats over whichever is shown. -->
      <BoardBulkBar />
    </template>

    <v-alert v-else rounded="lg" type="error" variant="tonal">
      This board is not available to you.
    </v-alert>

    <CardDialog
      v-if="openCardId"
      :card-id="openCardId"
      @changed="onCardChanged"
      @close="closeCard"
      @open-card="openCard"
    />

    <BoardArchive v-model="archiveDialog" />
    <BoardStatusesDialog v-model="statusesDialog" />
    <BoardFormsDialog v-model="formsDialog" />

    <!-- MEMBERS -->
    <v-dialog v-model="membersDialog" max-width="520">
      <v-card border rounded="lg">
        <v-card-title class="py-4">Board members</v-card-title>
        <v-divider />
        <v-card-text class="pt-4">
          <v-list class="bg-transparent" density="compact">
            <v-list-item v-for="m in board.members" :key="m.staff_id" class="px-0">
              <template #prepend>
                <StaffAvatar class="mr-3" :name="m.full_name" :size="34" />
              </template>
              <v-list-item-title class="text-body-2">{{ m.full_name }}</v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ ROLES.find((r) => r.value === m.role)?.title || m.role }}
              </v-list-item-subtitle>
              <template v-if="board.isOwner" #append>
                <v-btn
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  @click="removeMember(m.staff_id)"
                />
              </template>
            </v-list-item>
          </v-list>

          <template v-if="board.isOwner">
            <v-divider class="my-3" />
            <v-autocomplete
              v-model="addingUserId"
              class="mb-2"
              density="compact"
              item-title="name"
              item-value="id"
              :items="userOptions"
              label="Add someone"
            />
            <v-select
              v-model="addingRole"
              density="compact"
              item-title="title"
              item-value="value"
              :items="ROLES"
              label="Their role"
            />
            <v-btn
              block
              class="mt-2"
              color="primary"
              :disabled="!addingUserId"
              flat
              @click="addMember"
            >
              Add to board
            </v-btn>
          </template>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="membersDialog = false">Done</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
  import { onMounted, ref, watch } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import BoardKanban from "@/components/board/BoardKanban.vue";
  import BoardCalendar from "@/components/board/BoardCalendar.vue";
  import BoardTable from "@/components/board/BoardTable.vue";
  import BoardGantt from "@/components/board/BoardGantt.vue";
  import BoardWorkload from "@/components/board/BoardWorkload.vue";
  import BoardFilterBar from "@/components/board/BoardFilterBar.vue";
  import BoardViewBar from "@/components/board/BoardViewBar.vue";
  import BoardBulkBar from "@/components/board/BoardBulkBar.vue";
  import BoardArchive from "@/components/board/BoardArchive.vue";
  import BoardStatusesDialog from "@/components/board/BoardStatusesDialog.vue";
  import BoardFormsDialog from "@/components/board/BoardFormsDialog.vue";
  import CardDialog from "@/components/board/CardDialog.vue";

  const route = useRoute();
  const router = useRouter();
  const store = useStore();
  const board = useBoard();

  const membersDialog = ref(false);
  const archiveDialog = ref(false);
  const statusesDialog = ref(false);
  const formsDialog = ref(false);

  const userOptions = ref([]);
  const addingUserId = ref(null);
  const addingRole = ref("MEMBER");

  const ROLES = [
    { value: "OWNER", title: "Owner — can manage the board" },
    { value: "MEMBER", title: "Member — can create and edit cards" },
    { value: "OBSERVER", title: "Observer — read-only" },
  ];

  const VIEWS = [
    { value: "board", icon: "mdi-view-column-outline", label: "Board" },
    { value: "calendar", icon: "mdi-calendar-month-outline", label: "Calendar" },
    { value: "table", icon: "mdi-table", label: "Table" },
    { value: "gantt", icon: "mdi-chart-timeline", label: "Timeline" },
    { value: "workload", icon: "mdi-scale-balance", label: "Workload" },
  ];

  // The chosen view is a personal preference, so it is remembered per
  // board rather than shared with everyone else looking at it.
  const view = ref(localStorage.getItem(`hb_board_view_${route.query.id}`) || "board");
  watch(view, (v) => localStorage.setItem(`hb_board_view_${route.query.id}`, v));

  /**
   * The open card lives in the URL, so a card can be linked to and
   * shared — the same thing Trello does with its /c/:id URLs.
   */
  const openCardId = ref(route.query.card ? Number(route.query.card) : null);

  function openCard(id) {
    openCardId.value = id;
    router.replace({ name: "Board", query: { ...route.query, card: id } });
  }

  function closeCard() {
    openCardId.value = null;
    const query = { ...route.query };
    delete query.card;
    router.replace({ name: "Board", query });
  }

  async function onCardChanged() {
    // The card dialog already patches the board's copy in place for the
    // common edits; this catches the structural ones (subtasks,
    // dependencies) where a count on another card may also have moved.
  }

  async function load() {
    board.setViewer(store.state.auth?.id ?? null);
    await board.load(route.query.id);
    if (board.error) {
      store.commit("setMessage", { type: "error", text: board.error.message });
    }
  }

  async function openMembers() {
    membersDialog.value = true;
    if (!userOptions.value.length) {
      try {
        userOptions.value = await board.api.get("/boards/users");
      } catch (err) {
        store.commit("setMessage", { type: "error", text: err.message });
      }
    }
  }

  async function addMember() {
    if (!addingUserId.value) return;
    try {
      await board.api.post(`/boards/${route.query.id}/members`, {
        user_id: addingUserId.value,
        role: addingRole.value,
      });
      addingUserId.value = null;
      await board.refresh();
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  async function removeMember(userId) {
    try {
      await board.api.del(`/boards/${route.query.id}/members/${userId}`);
      await board.refresh();
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  async function archiveBoard() {
    if (!window.confirm(`Archive the board "${board.board.name}"? Its cards are kept.`)) return;
    try {
      await board.api.del(`/boards/${route.query.id}`);
      store.commit("setMessage", { type: "success", text: "Board archived" });
      router.push({ name: "BoardsList" });
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  watch(() => route.query.id, load);
  onMounted(load);
</script>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
