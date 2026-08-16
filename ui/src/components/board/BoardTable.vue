<template>
  <v-card rounded="lg" variant="outlined">
    <div class="table-scroll">
      <v-table density="comfortable" hover>
        <thead>
          <tr>
            <th class="sortable" @click="sortBy('title')">Card {{ arrow("title") }}</th>
            <th class="sortable" @click="sortBy('list')">List {{ arrow("list") }}</th>
            <th class="sortable" @click="sortBy('status')">Status {{ arrow("status") }}</th>
            <th class="sortable" @click="sortBy('priority')">Priority {{ arrow("priority") }}</th>
            <th class="sortable" @click="sortBy('due_at')">Due {{ arrow("due_at") }}</th>
            <th class="sortable" @click="sortBy('members')">Assigned {{ arrow("members") }}</th>
            <th
              v-for="fld in board.customFields"
              :key="fld.id"
              class="sortable"
              @click="sortBy(`cf:${fld.id}`)"
            >{{ fld.name }} {{ arrow(`cf:${fld.id}`) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in rows" :key="c.id" class="row" @click="emit('open-card', c.id)">
            <td>
              <div class="d-flex align-center ga-1">
                <v-icon
                  v-if="c.is_milestone"
                  color="warning"
                  icon="mdi-rhombus"
                  size="12"
                  title="Milestone"
                />
                <v-icon
                  v-if="c.is_blocked"
                  color="error"
                  icon="mdi-block-helper"
                  size="13"
                  title="Blocked"
                />
                <span class="text-body-2">{{ c.title }}</span>
              </div>
            </td>
            <td class="text-body-2">{{ listName(c.list_id) }}</td>
            <td>
              <v-chip
                v-if="statusOf(c.status_id)"
                label
                size="x-small"
                :style="{ color: statusOf(c.status_id).color }"
                variant="tonal"
              >{{ statusOf(c.status_id).name }}</v-chip>
            </td>
            <td>
              <v-chip
                v-if="priorityMeta(c.priority)"
                label
                size="x-small"
                :style="{ color: priorityMeta(c.priority).color }"
                variant="tonal"
              >
                <v-icon :icon="priorityMeta(c.priority).icon" size="11" start />
                {{ priorityMeta(c.priority).label }}
              </v-chip>
            </td>
            <td class="text-body-2">
              <span
                v-if="c.due_at"
                :class="{ 'text-error': !c.due_complete && new Date(c.due_at) < new Date() }"
              >{{ formatDate(c.due_at) }}</span>
            </td>
            <td>
              <div class="d-flex ga-1">
                <StaffAvatar
                  v-for="id in c.member_ids || []"
                  :key="id"
                  :name="board.memberById[id]?.full_name || ''"
                  :size="24"
                />
              </div>
            </td>
            <td v-for="fld in board.customFields" :key="fld.id" class="text-body-2">
              {{ cellValue(c, fld) }}
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <div v-if="!rows.length" class="pa-10 text-center">
      <v-icon class="mb-2" color="grey" icon="mdi-table-off" size="40" />
      <div class="text-body-2 text-medium-emphasis">No cards match the current filter.</div>
    </div>
  </v-card>
</template>

<script setup>
  import { computed, ref } from "vue";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { formatDate, priorityMeta, priorityRank } from "@/lib/boards";

  /**
   * The board as a sortable table — the view someone wants when the
   * question is "what is outstanding and who has it", not "what stage is
   * it at". Custom fields become columns, so a board's own vocabulary is
   * sortable too.
   */
  const emit = defineEmits(["open-card"]);

  const board = useBoard();

  const sortKey = ref("due_at");
  const sortAsc = ref(true);

  const listName = (id) => board.lists.find((l) => l.id === id)?.name || "";
  const statusOf = (id) => board.statusById[id] || null;

  const rows = computed(() => {
    const cards = (board.board?.cards || []).filter(board.matches);
    const dir = sortAsc.value ? 1 : -1;

    const value = (c) => {
      switch (sortKey.value) {
        case "title": return c.title.toLowerCase();
        case "list": return listName(c.list_id).toLowerCase();
        case "status": return statusOf(c.status_id)?.position ?? 0;
        case "priority": return priorityRank(c.priority);
        // Undated cards sort last whichever direction is chosen — an
        // absent deadline is not "earliest", it is "unknown".
        case "due_at": return c.due_at ? new Date(c.due_at).getTime() : Infinity;
        case "members": return (c.member_ids || []).length;
        default:
          if (sortKey.value.startsWith("cf:")) {
            const v = (c.custom || {})[Number(sortKey.value.slice(3))];
            return v === undefined || v === null ? "" : v;
          }
          return "";
      }
    };

    return [...cards].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === vb) return a.title.localeCompare(b.title);
      if (va === Infinity) return 1;
      if (vb === Infinity) return -1;
      return va > vb ? dir : -dir;
    });
  });

  function sortBy(key) {
    if (sortKey.value === key) sortAsc.value = !sortAsc.value;
    else {
      sortKey.value = key;
      sortAsc.value = true;
    }
  }

  const arrow = (key) => (sortKey.value === key ? (sortAsc.value ? "▲" : "▼") : "");

  const cellValue = (card, fld) => {
    const v = (card.custom || {})[fld.id];
    if (v === undefined || v === null) return "";
    if (fld.type === "CHECKBOX") return v ? "Yes" : "No";
    if (fld.type === "DATE") return formatDate(v);
    return String(v);
  };
</script>

<style scoped>
/* A board with many custom fields must scroll inside the card, never
   push the page sideways. */
.table-scroll {
  overflow-x: auto;
}
.sortable {
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.row {
  cursor: pointer;
}
</style>
