<template>
  <div v-if="!workload.length" class="text-center text-body-2 text-grey py-8">
    Nobody has been assigned a card on this board yet.
  </div>
  <v-row v-else dense>
    <v-col v-for="w in workload" :key="w.user_id" cols="12" md="4" sm="6">
      <v-card class="rounded-lg" variant="outlined">
        <v-card-text class="pa-4">
          <div class="d-flex align-center mb-2">
            <v-avatar class="mr-2" color="primary" size="32">
              <span class="text-caption text-white">{{ initials(w.user_name) }}</span>
            </v-avatar>
            <div class="text-subtitle-2 font-weight-bold">{{ w.user_name }}</div>
          </div>
          <div class="text-body-2">{{ w.card_count }} card{{ w.card_count === 1 ? "" : "s" }}</div>
          <div v-if="w.estimate_minutes" class="text-caption text-grey">
            {{ minutesToHuman(w.estimate_minutes) }} estimated
          </div>
          <v-chip v-if="w.overdue_count" class="mt-2" color="error" size="small" variant="flat">
            {{ w.overdue_count }} overdue
          </v-chip>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup>
  import { onMounted, ref, watch } from "vue";
  import { minutesToHuman } from "@/lib/boardFormat";

  const props = defineProps({ boardId: { type: [Number, String], required: true } });

  const workload = ref([]);

  async function load() {
    const res = await fetch(`/boards/${props.boardId}/workload`);
    const data = await res.json();
    workload.value = data.data || [];
  }

  function initials(name) {
    return (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  watch(() => props.boardId, load);
  onMounted(load);
</script>
