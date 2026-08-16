<template>
  <div class="d-flex align-center flex-wrap ga-2 mb-3">
    <v-chip
      v-for="v in views"
      :key="v.id"
      :color="active === v.id ? 'primary' : undefined"
      label
      size="small"
      :variant="active === v.id ? 'flat' : 'tonal'"
      @click="applyView(v)"
    >
      <v-icon
        v-if="v.is_shared"
        icon="mdi-account-multiple-outline"
        size="13"
        start
        title="Shared with the board"
      />
      {{ v.name }}
      <v-icon
        v-if="v.created_by_id === currentUserId"
        end
        icon="mdi-close"
        size="13"
        @click.stop="remove(v)"
      />
    </v-chip>

    <v-btn
      v-if="board.canEdit"
      prepend-icon="mdi-content-save-outline"
      size="small"
      variant="text"
      @click="dialog = true"
    >Save this view</v-btn>

    <v-spacer />

    <!-- Grouping is a way of looking at the same cards, not a change to them. -->
    <v-menu location="bottom end">
      <template #activator="{ props: p }">
        <v-btn v-bind="p" prepend-icon="mdi-group" size="small" variant="tonal">
          Group: {{ groupingLabel }}
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item
          v-for="g in GROUPINGS"
          :key="g.value"
          :prepend-icon="g.icon"
          :title="g.title"
          @click="board.setGroupBy(g.value)"
        >
          <template #append>
            <v-icon v-if="board.groupBy === g.value" color="success" icon="mdi-check" size="16" />
          </template>
        </v-list-item>
      </v-list>
    </v-menu>

    <span v-if="board.groupBy !== 'list'" class="text-caption text-medium-emphasis">
      Cards can't be moved while grouped this way
    </span>

    <v-dialog v-model="dialog" max-width="440">
      <v-card border rounded="lg">
        <v-card-title class="py-4">Save this view</v-card-title>
        <v-divider />
        <v-card-text class="pt-5">
          <v-text-field v-model="form.name" autofocus class="mb-2" label="Name" />
          <v-checkbox
            v-model="form.is_shared"
            density="compact"
            hide-details
            label="Share with everyone on this board"
          />
          <div class="text-caption text-medium-emphasis mt-2">
            Saves the current filter, grouping and view.
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" flat :loading="saving" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";

  /**
   * Named filter presets, shown as chips. A filter combination that has
   * to be rebuilt on every visit is one nobody uses twice; naming it
   * makes it a place you can return to, and sharing it means a team
   * looks at the same slice.
   */
  const props = defineProps({ viewType: { type: String, default: "board" } });
  const emit = defineEmits(["update:viewType"]);

  const board = useBoard();
  const store = useStore();

  const views = ref([]);
  const active = ref(null);
  const saving = ref(false);
  const dialog = ref(false);
  const form = ref({ name: "", is_shared: false });

  const currentUserId = computed(() => board.viewerId);

  const GROUPINGS = [
    { value: "list", title: "List", icon: "mdi-view-column-outline" },
    { value: "assignee", title: "Assignee", icon: "mdi-account-outline" },
    { value: "status", title: "Status", icon: "mdi-progress-check" },
    { value: "priority", title: "Priority", icon: "mdi-flag-outline" },
    { value: "due", title: "Due date", icon: "mdi-clock-outline" },
  ];

  const groupingLabel = computed(
    () => GROUPINGS.find((g) => g.value === board.groupBy)?.title || "List",
  );

  async function load() {
    try {
      views.value = await board.api.get(`/boards/${board.board.id}/views`);
    } catch {
      // The bar simply shows no saved views.
    }
  }

  function applyView(v) {
    active.value = v.id;
    board.applyView(v);
    if (v.view_type) emit("update:viewType", v.view_type);
  }

  /** Any manual change to the filter means you are no longer "on" a saved view. */
  watch(
    () => [board.filter, board.groupBy],
    () => {
      active.value = null;
    },
    { deep: true },
  );

  async function save() {
    if (!form.value.name.trim()) {
      store.commit("setMessage", { type: "error", text: "Give the view a name" });
      return;
    }
    saving.value = true;
    try {
      const view = await board.api.post(`/boards/${board.board.id}/views`, {
        name: form.value.name.trim(),
        view_type: props.viewType,
        filters: board.filter,
        group_by: board.groupBy,
        is_shared: form.value.is_shared,
      });
      views.value.push(view);
      active.value = view.id;
      dialog.value = false;
      form.value = { name: "", is_shared: false };
      store.commit("setMessage", { type: "success", text: "View saved" });
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    } finally {
      saving.value = false;
    }
  }

  async function remove(v) {
    try {
      await board.api.del(`/boards/views/${v.id}`);
      views.value = views.value.filter((x) => x.id !== v.id);
      if (active.value === v.id) active.value = null;
    } catch (err) {
      store.commit("setMessage", { type: "error", text: err.message });
    }
  }

  onMounted(load);
</script>
