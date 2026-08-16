<template>
  <v-dialog
    max-width="700"
    :model-value="modelValue"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card border rounded="lg">
      <v-card-title class="py-4">Intake forms</v-card-title>
      <v-divider />
      <v-card-text style="max-height: 65vh">
        <v-alert class="mb-4" density="compact" type="info" variant="tonal">
          A public form turns a request from someone with no login at all
          ("the mixer is making a noise") into a card on this board. Share
          the link; anyone who opens it can raise a card without seeing
          the board itself.
        </v-alert>

        <div v-for="f in forms" :key="f.id" class="form-row">
          <div class="flex-grow-1 min-w-0">
            <div class="text-body-2 font-weight-bold">{{ f.title }}</div>
            <div class="text-caption text-medium-emphasis text-truncate">
              {{ publicUrl(f.slug) }}
            </div>
          </div>
          <v-btn
            icon="mdi-content-copy"
            size="x-small"
            title="Copy link"
            variant="text"
            @click="copy(f.slug)"
          />
          <v-btn
            color="error"
            icon="mdi-delete-outline"
            size="x-small"
            variant="text"
            @click="remove(f)"
          />
        </div>

        <v-divider class="my-4" />

        <div class="eyebrow mb-2">New form</div>
        <v-row dense>
          <v-col cols="12" sm="5">
            <v-text-field
              v-model="draft.title"
              density="compact"
              hide-details
              label="Title"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="draft.slug"
              density="compact"
              hide-details
              hint="Used in the link"
              label="Link name"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-select
              v-model="draft.list_id"
              density="compact"
              hide-details
              item-title="name"
              item-value="id"
              :items="board.lists"
              label="Adds to list"
              variant="outlined"
            />
          </v-col>
        </v-row>

        <div class="eyebrow mt-4 mb-2">Questions</div>
        <div v-for="(fld, i) in draft.fields" :key="i" class="d-flex ga-2 mb-2 align-center">
          <v-text-field
            v-model="fld.label"
            density="compact"
            hide-details
            placeholder="Question"
            variant="outlined"
          />
          <v-select
            v-model="fld.type"
            density="compact"
            hide-details
            :items="FIELD_TYPES"
            style="max-width: 150px"
            variant="outlined"
          />
          <v-checkbox v-model="fld.required" density="compact" hide-details label="Required" />
          <v-btn icon="mdi-close" size="x-small" variant="text" @click="draft.fields.splice(i, 1)" />
        </div>
        <v-btn prepend-icon="mdi-plus" size="small" variant="text" @click="addField">
          Add a question
        </v-btn>

        <div class="mt-4">
          <v-btn color="primary" flat @click="create">Create form</v-btn>
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { reactive, ref, watch } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";

  const props = defineProps({ modelValue: { type: Boolean, default: false } });
  const emit = defineEmits(["update:modelValue"]);

  const board = useBoard();
  const store = useStore();

  const forms = ref([]);
  const FIELD_TYPES = ["TEXT", "TEXTAREA", "SELECT", "EMAIL"];

  const draft = reactive({ title: "", slug: "", list_id: null, fields: [] });

  const publicUrl = (slug) =>
    `${window.location.origin}/BoardForm?slug=${encodeURIComponent(slug)}`;

  const fail = (err) => store.commit("setMessage", { type: "error", text: err.message });

  async function load() {
    try {
      forms.value = await board.api.get(`/boards/${board.board.id}/forms`);
    } catch (err) {
      fail(err);
    }
  }

  function addField() {
    draft.fields.push({
      key: `q${draft.fields.length + 1}`,
      label: "",
      type: "TEXT",
      required: false,
    });
  }

  async function create() {
    if (!draft.title.trim() || !draft.slug.trim() || !draft.list_id) {
      store.commit("setMessage", {
        type: "error",
        text: "A title, link name and list are all required",
      });
      return;
    }
    try {
      await board.api.post(`/boards/${board.board.id}/forms`, {
        title: draft.title.trim(),
        slug: draft.slug.trim(),
        list_id: draft.list_id,
        fields: draft.fields.filter((f) => f.label.trim()),
        is_public: true,
      });
      draft.title = "";
      draft.slug = "";
      draft.list_id = null;
      draft.fields = [];
      await load();
      store.commit("setMessage", { type: "success", text: "Form created" });
    } catch (err) {
      fail(err);
    }
  }

  async function remove(form) {
    if (!window.confirm(`Delete the form "${form.title}"?`)) return;
    try {
      await board.api.del(`/boards/forms/${form.id}`);
      await load();
    } catch (err) {
      fail(err);
    }
  }

  async function copy(slug) {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      store.commit("setMessage", { type: "success", text: "Link copied" });
    } catch {
      store.commit("setMessage", { type: "info", text: publicUrl(slug) });
    }
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (open) load();
    },
  );
</script>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.min-w-0 {
  min-width: 0;
}
.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.55);
}
</style>
