<template>
  <div v-if="!rows.length" class="text-center text-body-2 text-grey py-8">
    No time has been logged on this board yet.
  </div>
  <v-table v-else density="compact">
    <thead>
      <tr class="bg-grey-lighten-4">
        <th class="text-left">STAFF</th>
        <th class="text-left">CARD</th>
        <th class="text-right">TIME LOGGED</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(r, i) in rows" :key="i">
        <td>{{ r.user_name }}</td>
        <td>{{ r.card_title }}</td>
        <td class="text-right">{{ minutesToHuman(r.minutes) }}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="font-weight-bold">
        <td colspan="2">Total</td>
        <td class="text-right">{{ minutesToHuman(total) }}</td>
      </tr>
    </tfoot>
  </v-table>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from "vue";
  import { minutesToHuman } from "@/lib/boardFormat";

  const props = defineProps({ boardId: { type: [Number, String], required: true } });

  const rows = ref([]);
  const total = computed(() => rows.value.reduce((s, r) => s + Number(r.minutes), 0));

  async function load() {
    const res = await fetch(`/boards/${props.boardId}/time-report`);
    const data = await res.json();
    rows.value = data.data || [];
  }

  watch(() => props.boardId, load);
  onMounted(load);
</script>
