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
      <v-tabs v-model="tab" color="primary" grow>
        <v-tab value="date">Date</v-tab>
        <v-tab value="time">Time</v-tab>
      </v-tabs>
      <v-window v-model="tab">
        <v-window-item value="date">
          <v-date-picker v-model="dateValue" hide-header show-adjacent-months />
        </v-window-item>
        <v-window-item value="time">
          <v-time-picker
            v-model="timeValue"
            elevation="0"
            format="24hr"
            full-width
          />
        </v-window-item>
      </v-window>
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
const tab = ref("date");
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
    tab.value = "date";
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
