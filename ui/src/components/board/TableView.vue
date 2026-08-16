<template>
  <v-table density="compact">
    <thead>
      <tr class="bg-grey-lighten-4">
        <th class="text-left">CARD</th>
        <th class="text-left">LIST</th>
        <th class="text-left">STATUS</th>
        <th class="text-left">PRIORITY</th>
        <th class="text-left">ASSIGNEES</th>
        <th class="text-left">DUE</th>
        <th class="text-right">CHECKLIST</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="card in sorted"
        :key="card.id"
        class="table-row"
        @click="$emit('open-card', card.id)"
      >
        <td>{{ card.title }}</td>
        <td>{{ listName(card.list_id) }}</td>
        <td>
          <v-chip v-if="statusFor(card)" :color="statusFor(card).color" size="x-small" variant="flat">
            {{ statusFor(card).name }}
          </v-chip>
        </td>
        <td>
          <v-chip v-if="card.priority" :color="PRIORITY_COLORS[card.priority]" size="x-small" variant="flat">
            {{ card.priority }}
          </v-chip>
        </td>
        <td>{{ (card.members || []).map((m) => m.name).join(", ") }}</td>
        <td :class="{ 'text-error font-weight-bold': isOverdue(card) }">
          {{ formatDate(card.due_at) }}
        </td>
        <td class="text-right">
          <span v-if="card.checklist_total">{{ card.checklist_done }}/{{ card.checklist_total }}</span>
        </td>
      </tr>
    </tbody>
  </v-table>
</template>

<script setup>
  import { computed } from "vue";
  import { formatDate, isOverdue, PRIORITY_COLORS } from "@/lib/boardFormat";

  const props = defineProps({
    cards: { type: Array, required: true },
    lists: { type: Array, required: true },
    statuses: { type: Array, default: () => [] },
  });
  defineEmits(["open-card"]);

  const sorted = computed(() =>
    [...props.cards].sort((a, b) => a.list_id - b.list_id || a.position - b.position),
  );

  function listName(id) {
    return props.lists.find((l) => l.id === id)?.name || "";
  }

  function statusFor(card) {
    return props.statuses.find((s) => s.id === card.status_id);
  }
</script>

<style scoped>
.table-row {
  cursor: pointer;
}
</style>
