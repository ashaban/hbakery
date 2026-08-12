<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    location="bottom"
    min-width="auto"
  >
    <template #activator="{ props: activatorProps }">
      <v-text-field
        v-bind="activatorProps"
        :clearable="clearable && !!modelValue"
        density="comfortable"
        :error="error"
        :label="label"
        :model-value="modelValue"
        :placeholder="placeholder || label"
        prepend-inner-icon="mdi-calendar"
        readonly
        :required="required"
        variant="outlined"
        @click:clear.stop="clear"
      />
    </template>

    <v-date-picker
      v-model="dateValue"
      hide-header
      :max="maxDate"
      :min="minDate"
      show-adjacent-months
      @update:model-value="apply"
    />
  </v-menu>
</template>

<script setup>
// Native Vuetify date picker (menu + v-date-picker), replacing
// @vuepic/vue-datepicker app-wide — VueDatePicker's popup was unreliable
// on mobile taps. Keeps the same wire format ("DD/MM/YYYY", matching
// utils/date.js's formatDMY/toISODateOnly) so surrounding logic doesn't
// need to change, only the field component.
import { ref, watch } from "vue";
import moment from "moment";

const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: "" },
  placeholder: { type: String, default: "" },
  clearable: { type: Boolean, default: true },
  error: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  minDate: { type: [Date, null], default: undefined },
  maxDate: { type: [Date, null], default: undefined },
});
const emit = defineEmits(["update:modelValue", "blur"]);

const menu = ref(false);
const dateValue = ref(null);

function syncFromModelValue(value) {
  const m = moment(value, "DD/MM/YYYY", true);
  dateValue.value = m.isValid() ? m.toDate() : null;
}

syncFromModelValue(props.modelValue);
watch(
  () => props.modelValue,
  (value) => {
    if (!menu.value) syncFromModelValue(value);
  },
);

watch(menu, (isOpen) => {
  if (isOpen) {
    syncFromModelValue(props.modelValue);
  } else {
    emit("blur");
  }
});

function apply(value) {
  emit("update:modelValue", value ? moment(value).format("DD/MM/YYYY") : "");
  menu.value = false;
}

function clear() {
  dateValue.value = null;
  emit("update:modelValue", "");
}
</script>
