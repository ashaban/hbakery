<template>
  <div class="d-flex align-center flex-wrap ga-2 mb-3">
    <v-text-field
      clearable
      density="compact"
      hide-details
      :model-value="f.text"
      placeholder="Search this board"
      prepend-inner-icon="mdi-magnify"
      :style="mobile ? 'min-width:150px;flex:1' : 'max-width:240px'"
      variant="outlined"
      @update:model-value="set({ text: $event || '' })"
    />

    <v-btn
      v-if="mobile"
      :color="activeCount ? 'primary' : undefined"
      :prepend-icon="showFilters ? 'mdi-filter-off-outline' : 'mdi-filter-variant'"
      size="small"
      variant="tonal"
      @click="showFilters = !showFilters"
    >
      {{ activeCount || "" }}
    </v-btn>

    <template v-if="filtersVisible">
      <v-menu :close-on-content-click="false" location="bottom start">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :color="f.labels.length ? 'primary' : undefined"
            prepend-icon="mdi-label-outline"
            size="small"
            variant="tonal"
          >
            Labels<span v-if="f.labels.length">&nbsp;({{ f.labels.length }})</span>
          </v-btn>
        </template>
        <v-card border min-width="230" rounded="lg">
          <v-list density="compact">
            <v-list-item v-for="l in board.labels" :key="l.id" @click="toggleIn('labels', l.id)">
              <template #prepend>
                <span class="filter-swatch mr-3" :style="{ background: l.color }" />
              </template>
              <v-list-item-title class="text-body-2">{{ l.name || "No name" }}</v-list-item-title>
              <template #append>
                <v-icon v-if="f.labels.includes(l.id)" color="success" icon="mdi-check" size="16" />
              </template>
            </v-list-item>
            <v-list-item
              v-if="!board.labels.length"
              class="text-caption text-medium-emphasis"
              title="No labels on this board yet"
            />
          </v-list>
        </v-card>
      </v-menu>

      <v-menu :close-on-content-click="false" location="bottom start">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :color="f.members.length ? 'primary' : undefined"
            prepend-icon="mdi-account-outline"
            size="small"
            variant="tonal"
          >
            Members<span v-if="f.members.length">&nbsp;({{ f.members.length }})</span>
          </v-btn>
        </template>
        <v-card border min-width="240" rounded="lg">
          <v-list density="compact">
            <v-list-item
              v-for="m in board.members"
              :key="m.staff_id"
              :title="m.full_name"
              @click="toggleIn('members', m.staff_id)"
            >
              <template #prepend>
                <StaffAvatar class="mr-2" :name="m.full_name" :size="26" :tooltip="false" />
              </template>
              <template #append>
                <v-icon
                  v-if="f.members.includes(m.staff_id)"
                  color="success"
                  icon="mdi-check"
                  size="16"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>

      <v-menu :close-on-content-click="false" location="bottom start">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :color="f.statuses.length ? 'primary' : undefined"
            prepend-icon="mdi-progress-check"
            size="small"
            variant="tonal"
          >
            Status<span v-if="f.statuses.length">&nbsp;({{ f.statuses.length }})</span>
          </v-btn>
        </template>
        <v-card border min-width="220" rounded="lg">
          <v-list density="compact">
            <v-list-item
              v-for="s in board.statuses"
              :key="s.id"
              :title="s.name"
              @click="toggleIn('statuses', s.id)"
            >
              <template #prepend>
                <span class="status-dot mr-3" :style="{ background: s.color }" />
              </template>
              <template #append>
                <v-icon v-if="f.statuses.includes(s.id)" color="success" icon="mdi-check" size="16" />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>

      <v-menu :close-on-content-click="false" location="bottom start">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :color="f.priorities.length ? 'primary' : undefined"
            prepend-icon="mdi-flag-outline"
            size="small"
            variant="tonal"
          >
            Priority<span v-if="f.priorities.length">&nbsp;({{ f.priorities.length }})</span>
          </v-btn>
        </template>
        <v-card border min-width="200" rounded="lg">
          <v-list density="compact">
            <v-list-item
              v-for="p2 in PRIORITIES"
              :key="p2.value"
              :title="p2.label"
              @click="toggleIn('priorities', p2.value)"
            >
              <template #prepend>
                <v-icon class="mr-3" :color="p2.color" :icon="p2.icon" size="16" />
              </template>
              <template #append>
                <v-icon
                  v-if="f.priorities.includes(p2.value)"
                  color="success"
                  icon="mdi-check"
                  size="16"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>

      <v-menu location="bottom start">
        <template #activator="{ props: p }">
          <v-btn
            v-bind="p"
            :color="f.due ? 'primary' : undefined"
            prepend-icon="mdi-clock-outline"
            size="small"
            variant="tonal"
          >
            {{ DUE_OPTIONS.find((o) => o.value === f.due)?.title || "Due date" }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item
            v-for="o in DUE_OPTIONS"
            :key="o.value"
            :title="o.title"
            @click="set({ due: f.due === o.value ? null : o.value })"
          >
            <template #append>
              <v-icon v-if="f.due === o.value" color="success" icon="mdi-check" size="16" />
            </template>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-btn
        :color="f.watching ? 'primary' : undefined"
        prepend-icon="mdi-eye-outline"
        size="small"
        variant="tonal"
        @click="set({ watching: !f.watching })"
      >
        Watching
      </v-btn>

      <v-btn v-if="activeCount" prepend-icon="mdi-close" size="small" variant="text" @click="clear">
        Clear {{ activeCount }} filter{{ activeCount === 1 ? "" : "s" }}
      </v-btn>
    </template>

    <!-- Neighbours can't be worked out reliably when cards are hidden,
         so reordering waits until the filter is cleared. -->
    <span v-if="activeCount" class="text-caption text-medium-emphasis">
      Cards can't be moved while a filter is on
    </span>
  </div>
</template>

<script setup>
  import { computed, ref } from "vue";
  import { useDisplay } from "vuetify";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { blankFilter, PRIORITIES } from "@/lib/boards";

  /**
   * Filters run entirely in the browser against the already-loaded board,
   * so they apply the instant they are picked.
   */
  const props = defineProps({ modelValue: { type: Object, required: true } });
  const emit = defineEmits(["update:modelValue"]);

  const board = useBoard();

  /**
   * On a phone the six filter buttons wrap to five rows and push every
   * card below the fold. They collapse behind one button instead; the
   * search box stays out, since typing a word is the filter people reach
   * for first.
   */
  const { mobile } = useDisplay();
  const showFilters = ref(false);
  const filtersVisible = computed(() => !mobile.value || showFilters.value);

  const DUE_OPTIONS = [
    { value: "overdue", title: "Overdue" },
    { value: "day", title: "Due within a day" },
    { value: "week", title: "Due within a week" },
    { value: "none", title: "No due date" },
    { value: "complete", title: "Marked complete" },
  ];

  const f = computed(() => props.modelValue);
  const set = (patch) => emit("update:modelValue", { ...props.modelValue, ...patch });

  const toggleIn = (key, value) => {
    const list = props.modelValue[key];
    set({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });
  };

  const activeCount = computed(
    () =>
      f.value.labels.length + f.value.members.length + f.value.statuses.length +
      f.value.priorities.length + (f.value.due ? 1 : 0) + (f.value.watching ? 1 : 0) +
      (f.value.text.trim() ? 1 : 0),
  );

  const clear = () => emit("update:modelValue", blankFilter());
</script>

<style scoped>
.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}
.filter-swatch {
  width: 34px;
  height: 16px;
  border-radius: 4px;
  display: inline-block;
}
</style>
