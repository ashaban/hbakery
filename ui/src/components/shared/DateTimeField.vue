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
        :label="modelValue ? label : ''"
        :model-value="modelValue"
        :placeholder="placeholder || label"
        prepend-inner-icon="mdi-calendar-clock"
        readonly
        variant="outlined"
      />
    </template>

    <v-card min-width="300">
      <!-- Date and time pickers are both always mounted (not tab-hidden) —
           v-time-picker's clock face measures its own size on mount, and
           if it mounts while hidden inside an inactive v-window-item it
           computes a zero/bogus size and stays visually blank even after
           switching to it. Stacking both avoids that class of bug. -->
      <v-date-picker v-model="dateValue" hide-header show-adjacent-months />
      <v-divider />
      <v-time-picker v-model="timeValue" elevation="0" format="24hr" full-width />
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel">Cancel</v-btn>
        <v-btn color="primary" variant="flat" @click="apply">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-menu>
</template>

<script setup>
// Native Vuetify date+time picker, replacing @vuepic/vue-datepicker for the
// two spots in Productions.vue that need date AND time (planned/produced
// timestamps) — VueDatePicker's popup was unreliable on mobile taps for
// these fields. Keeps the same wire format ("DD/MM/YYYY HH:mm", matching
// utils/date.js's toDisplay/toISO) so no surrounding logic has to change.
import { ref, watch } from "vue";
import moment from "moment";

const props = defineProps({
  modelValue: { type: String, default: "" },
  label: { type: String, default: "" },
  placeholder: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const menu = ref(false);
const dateValue = ref(new Date());
const timeValue = ref(moment().format("HH:mm"));

function syncFromModelValue(value) {
  const m = moment(value, "DD/MM/YYYY HH:mm", true);
  if (m.isValid()) {
    dateValue.value = m.toDate();
    timeValue.value = m.format("HH:mm");
  }
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
  }
});

function apply() {
  const combined = `${moment(dateValue.value).format("DD/MM/YYYY")} ${timeValue.value}`;
  emit("update:modelValue", combined);
  menu.value = false;
}

function cancel() {
  syncFromModelValue(props.modelValue);
  menu.value = false;
}
</script>
