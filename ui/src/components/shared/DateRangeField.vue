<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    location="bottom"
    min-width="auto"
  >
    <template #activator="{ props: activatorProps }">
      <v-text-field
        autocomplete="off"
        v-bind="activatorProps"
        clearable
        density="comfortable"
        :model-value="displayText"
        :placeholder="placeholder"
        prepend-inner-icon="mdi-calendar-range"
        readonly
        variant="outlined"
        @click:clear.stop="clear"
      />
    </template>

    <v-date-picker
      v-model="rangeValue"
      hide-header
      multiple="range"
      show-adjacent-months
    />
  </v-menu>
</template>

<script setup>
// Native Vuetify date-range picker, replacing @vuepic/vue-datepicker's
// `range` mode. v-model shape ([Date, Date] | null) matches what
// VueDatePicker's range mode produced, so callers don't need to change.
import { computed, ref, watch } from "vue";
import moment from "moment";

const props = defineProps({
  modelValue: { type: Array, default: null },
  placeholder: { type: String, default: "Select date range" },
});
const emit = defineEmits(["update:modelValue"]);

const menu = ref(false);
const rangeValue = ref(props.modelValue || []);

watch(
  () => props.modelValue,
  (value) => {
    if (!menu.value) rangeValue.value = value || [];
  },
);

// v-date-picker's range mode emits every date in between as the user
// drags across the calendar; only commit [start, end] back out once both
// ends have been picked.
watch(rangeValue, (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const sorted = [...value].sort((a, b) => a - b);
    const range = [sorted[0], sorted[sorted.length - 1]];
    emit("update:modelValue", range);
    menu.value = false;
  }
});

const displayText = computed(() => {
  const value = props.modelValue;
  if (!Array.isArray(value) || !value[0] || !value[1]) return "";
  return `${moment(value[0]).format("DD/MM/YYYY")} - ${moment(value[1]).format("DD/MM/YYYY")}`;
});

function clear() {
  rangeValue.value = [];
  emit("update:modelValue", null);
}
</script>
