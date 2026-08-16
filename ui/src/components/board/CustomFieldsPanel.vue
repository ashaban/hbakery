<template>
  <div>
    <div v-for="fld in board.customFields" :key="fld.id" class="mb-3">
      <div class="d-flex align-center ga-2">
        <span class="text-caption text-medium-emphasis flex-grow-1">{{ fld.name }}</span>
        <v-btn
          v-if="board.isOwner"
          icon="mdi-delete-outline"
          size="x-small"
          variant="text"
          @click="removeField(fld)"
        />
      </div>

      <v-text-field
        v-if="fld.type === 'TEXT'"
        density="compact"
        :disabled="!canEdit"
        hide-details
        :model-value="values[fld.id] || ''"
        variant="outlined"
        @change="setValue(fld, $event.target.value)"
      />
      <v-text-field
        v-else-if="fld.type === 'NUMBER'"
        density="compact"
        :disabled="!canEdit"
        hide-details
        :model-value="values[fld.id] ?? ''"
        type="number"
        variant="outlined"
        @change="setValue(fld, $event.target.value)"
      />
      <input
        v-else-if="fld.type === 'DATE'"
        class="field-input"
        :disabled="!canEdit"
        type="date"
        :value="toDateInput(values[fld.id])"
        @change="setValue(fld, $event.target.value)"
      >
      <v-checkbox-btn
        v-else-if="fld.type === 'CHECKBOX'"
        density="compact"
        :disabled="!canEdit"
        :model-value="Boolean(values[fld.id])"
        @update:model-value="setValue(fld, $event)"
      />
      <v-select
        v-else-if="fld.type === 'DROPDOWN'"
        clearable
        density="compact"
        :disabled="!canEdit"
        hide-details
        :items="fld.options"
        :model-value="values[fld.id] || null"
        @update:model-value="setValue(fld, $event)"
      />
    </div>

    <div v-if="!board.customFields.length" class="text-caption text-medium-emphasis mb-2">
      No custom fields on this board yet.
    </div>

    <template v-if="board.isOwner">
      <v-btn
        v-if="!managing"
        prepend-icon="mdi-form-textbox"
        size="small"
        variant="tonal"
        @click="managing = true"
      >Add a field</v-btn>

      <v-card v-else border class="pa-3 mt-2" rounded="lg">
        <v-text-field v-model="draft.name" class="mb-2" density="compact" label="Field name" />
        <v-select
          v-model="draft.type"
          class="mb-2"
          density="compact"
          item-title="title"
          item-value="value"
          :items="TYPES"
          label="Type"
        />
        <v-text-field
          v-if="draft.type === 'DROPDOWN'"
          v-model="draft.options"
          class="mb-2"
          density="compact"
          label="Choices, separated by commas"
        />
        <v-checkbox
          v-model="draft.show_on_front"
          class="mb-2"
          density="compact"
          hide-details
          label="Show on the front of the card"
        />
        <div class="d-flex ga-2">
          <v-btn color="primary" flat size="small" @click="addField">Add field</v-btn>
          <v-btn size="small" variant="text" @click="managing = false">Done</v-btn>
        </div>
      </v-card>
    </template>
  </div>
</template>

<script setup>
  import { ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";

  /**
   * Per-card values for the board's custom fields. The definitions belong
   * to the board and are managed by its owner; everyone who can edit a
   * card can fill them in.
   */
  const props = defineProps({
    cardId: { type: [String, Number], required: true },
    values: { type: Object, default: () => ({}) },
    canEdit: { type: Boolean, default: false },
  });
  const emit = defineEmits(["changed"]);

  const board = useBoard();
  const store = useStore();

  const managing = ref(false);
  const draft = ref(blankField());

  function blankField() {
    return { name: "", type: "TEXT", options: "", show_on_front: false };
  }

  const TYPES = [
    { value: "TEXT", title: "Text" },
    { value: "NUMBER", title: "Number" },
    { value: "DATE", title: "Date" },
    { value: "CHECKBOX", title: "Yes / no" },
    { value: "DROPDOWN", title: "Choice from a list" },
  ];

  const toDateInput = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  const fail = (err) => store.commit("setMessage", { type: "error", text: err.message });

  async function setValue(field, value) {
    try {
      await board.api.put(`/boards/cards/${props.cardId}/custom-fields/${field.id}`, { value });
      emit("changed");
    } catch (err) {
      fail(err);
    }
  }

  async function addField() {
    if (!draft.value.name.trim()) {
      store.commit("setMessage", { type: "error", text: "Give the field a name" });
      return;
    }
    const options = draft.value.type === "DROPDOWN"
      ? draft.value.options.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    if (draft.value.type === "DROPDOWN" && !options.length) {
      store.commit("setMessage", { type: "error", text: "List the choices, separated by commas" });
      return;
    }
    try {
      await board.api.post(`/boards/${board.board.id}/custom-fields`, {
        name: draft.value.name.trim(),
        type: draft.value.type,
        options,
        show_on_front: draft.value.show_on_front,
      });
      draft.value = blankField();
      await board.refresh();
    } catch (err) {
      fail(err);
    }
  }

  async function removeField(field) {
    if (!window.confirm(`Delete the field "${field.name}" and its values on every card?`)) return;
    try {
      await board.api.del(`/boards/custom-fields/${field.id}`);
      await board.refresh();
      emit("changed");
    } catch (err) {
      fail(err);
    }
  }
</script>

<style scoped>
.field-input {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 8px;
  font: inherit;
  color: inherit;
  background: transparent;
}
</style>
