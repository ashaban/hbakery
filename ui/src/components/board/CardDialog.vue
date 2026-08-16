<template>
  <v-dialog
    max-width="760"
    :model-value="!!cardId"
    scrollable
    @update:model-value="(v) => !v && $emit('close')"
  >
    <v-card v-if="card" class="rounded-lg">
      <v-toolbar color="primary" density="comfortable">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">
          {{ card.title }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="$emit('close')">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text class="pa-6" style="max-height: 75vh">
        <!-- TITLE / DESCRIPTION -->
        <v-text-field
          v-model="editTitle"
          class="mb-2"
          density="comfortable"
          label="Title"
          variant="outlined"
          @blur="saveField('title', editTitle)"
        />
        <v-textarea
          v-model="editDescription"
          auto-grow
          class="mb-4"
          density="comfortable"
          label="Description"
          rows="2"
          variant="outlined"
          @blur="saveField('description', editDescription)"
        />

        <!-- QUICK FIELDS -->
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-select
              v-model="editStatusId"
              density="compact"
              item-title="name"
              item-value="id"
              :items="statuses"
              label="Status"
              variant="outlined"
              @update:model-value="(v) => saveField('status_id', v)"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select
              v-model="editPriority"
              clearable
              density="compact"
              :items="['URGENT', 'HIGH', 'NORMAL', 'LOW']"
              label="Priority"
              variant="outlined"
              @update:model-value="(v) => saveField('priority', v)"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-checkbox
              v-model="editMilestone"
              density="compact"
              hide-details
              label="Milestone"
              @update:model-value="(v) => saveField('is_milestone', v)"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <DateField
              v-model="editStart"
              label="Start"
              @update:model-value="(v) => saveField('start_at', toISO(v))"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <DateField
              v-model="editDue"
              label="Due"
              @update:model-value="(v) => saveField('due_at', toISO(v))"
            />
          </v-col>
        </v-row>

        <!-- ASSIGNEES -->
        <div class="text-subtitle-2 font-weight-bold mt-2 mb-1">Assignees</div>
        <v-autocomplete
          v-model="editMembers"
          chips
          closable-chips
          density="compact"
          item-title="name"
          item-value="id"
          :items="userList"
          multiple
          variant="outlined"
          @update:model-value="saveMembers"
        />

        <!-- LABELS / TAGS -->
        <div class="text-subtitle-2 font-weight-bold mb-1">Labels</div>
        <div class="d-flex flex-wrap ga-2 mb-3">
          <v-chip
            v-for="l in boardLabels"
            :key="l.id"
            :color="l.color"
            :variant="hasLabel(l.id) ? 'flat' : 'outlined'"
            @click="toggleLabel(l.id)"
          >
            {{ l.name || "(unnamed)" }}
          </v-chip>
        </div>

        <div class="text-subtitle-2 font-weight-bold mb-1">Tags</div>
        <v-combobox
          v-model="editTags"
          chips
          closable-chips
          density="compact"
          hide-details
          multiple
          variant="outlined"
          @update:model-value="saveTags"
        />

        <v-divider class="my-4" />

        <!-- CHECKLISTS -->
        <div class="d-flex align-center mb-2">
          <div class="text-subtitle-2 font-weight-bold">Checklist</div>
          <v-spacer />
          <v-btn v-if="!card.checklists.length" size="small" variant="text" @click="addChecklist">
            <v-icon start>mdi-plus</v-icon>
            Add checklist
          </v-btn>
        </div>
        <div v-for="cl in card.checklists" :key="cl.id" class="mb-4">
          <v-progress-linear
            class="mb-2"
            color="success"
            height="6"
            :model-value="checklistPct(cl)"
            rounded
          />
          <div v-for="item in cl.items" :key="item.id" class="d-flex align-center">
            <v-checkbox-btn
              :model-value="item.is_done"
              @update:model-value="(v) => toggleItem(item, v)"
            />
            <span :class="{ 'text-decoration-line-through text-grey': item.is_done }">
              {{ item.content }}
            </span>
            <v-spacer />
            <v-btn color="error" icon size="x-small" variant="text" @click="deleteItem(item)">
              <v-icon size="16">mdi-close</v-icon>
            </v-btn>
          </div>
          <div class="d-flex mt-1">
            <v-text-field
              v-model="newItemText[cl.id]"
              density="compact"
              hide-details
              placeholder="Add an item…"
              variant="outlined"
              @keyup.enter="addItem(cl)"
            />
            <v-btn class="ml-2" color="primary" variant="tonal" @click="addItem(cl)">Add</v-btn>
          </div>
        </div>

        <v-divider class="my-4" />

        <!-- SUBTASKS -->
        <div class="text-subtitle-2 font-weight-bold mb-2">Subtasks</div>
        <div v-for="s in card.subtasks" :key="s.id" class="d-flex align-center mb-1">
          <v-icon class="mr-1" color="grey" size="16">mdi-file-tree-outline</v-icon>
          <span :class="{ 'text-decoration-line-through text-grey': s.is_archived }">{{ s.title }}</span>
        </div>
        <div v-if="!card.parent_card_id" class="d-flex mt-1">
          <v-text-field
            v-model="newSubtaskTitle"
            density="compact"
            hide-details
            placeholder="Add a subtask…"
            variant="outlined"
            @keyup.enter="addSubtask"
          />
          <v-btn class="ml-2" color="primary" variant="tonal" @click="addSubtask">Add</v-btn>
        </div>

        <v-divider class="my-4" />

        <!-- DEPENDENCIES -->
        <div class="text-subtitle-2 font-weight-bold mb-2">Blocked by</div>
        <div v-if="!card.blocked_by.length" class="text-body-2 text-grey mb-2">
          Nothing is blocking this card.
        </div>
        <v-chip
          v-for="dep in card.blocked_by"
          :key="dep.blocker_card_id"
          class="mr-2 mb-2"
          closable
          :color="dep.blocker_status === 'DONE' ? 'success' : 'warning'"
          variant="tonal"
          @click:close="removeDependency(dep.blocker_card_id)"
        >
          {{ dep.blocker_title }}
        </v-chip>
        <div class="d-flex align-center mt-1">
          <v-select
            v-model="blockerCardId"
            density="compact"
            hide-details
            item-title="title"
            item-value="id"
            :items="otherCards"
            placeholder="Block on another card…"
            variant="outlined"
          />
          <v-btn class="ml-2" color="primary" variant="tonal" @click="addDependency">Add</v-btn>
        </div>

        <v-divider class="my-4" />

        <!-- TIME TRACKING -->
        <div class="d-flex align-center mb-2">
          <div class="text-subtitle-2 font-weight-bold">Time tracked</div>
          <v-spacer />
          <span class="text-caption text-grey mr-2">{{ minutesToHuman(card.logged_minutes) }}</span>
          <v-btn
            v-if="!runningEntryId"
            color="primary"
            size="small"
            variant="tonal"
            @click="startTimer"
          >
            <v-icon start>mdi-play</v-icon>
            Start
          </v-btn>
          <v-btn v-else color="error" size="small" variant="flat" @click="stopTimer">
            <v-icon start>mdi-stop</v-icon>
            Stop
          </v-btn>
        </div>
        <div v-for="t in card.time_entries" :key="t.id" class="text-body-2">
          {{ t.staff_name }} — {{ minutesToHuman(t.minutes) }}
          <span v-if="t.note" class="text-grey">({{ t.note }})</span>
        </div>

        <v-divider class="my-4" />

        <!-- LINKS -->
        <div class="text-subtitle-2 font-weight-bold mb-2">Links</div>
        <div v-for="l in card.links" :key="l.id" class="d-flex align-center mb-1">
          <v-icon class="mr-1" color="primary" size="16">mdi-link</v-icon>
          <a :href="l.url" rel="noopener" target="_blank">{{ l.label || l.url }}</a>
          <v-spacer />
          <v-btn color="error" icon size="x-small" variant="text" @click="deleteLink(l)">
            <v-icon size="16">mdi-close</v-icon>
          </v-btn>
        </div>
        <div class="d-flex mt-1">
          <v-text-field
            v-model="newLinkUrl"
            density="compact"
            hide-details
            placeholder="Paste a link (Drive, WhatsApp, photo…)"
            variant="outlined"
          />
          <v-btn class="ml-2" color="primary" variant="tonal" @click="addLink">Add</v-btn>
        </div>

        <v-divider class="my-4" />

        <!-- COMMENTS -->
        <div class="text-subtitle-2 font-weight-bold mb-2">Comments</div>
        <div v-for="c in card.comments" :key="c.id" class="mb-3">
          <div class="text-caption text-grey">
            {{ c.staff_name }} · {{ formatDateTime(c.created_at) }}
            <v-chip v-if="c.resolved_at" class="ml-1" color="success" size="x-small" variant="tonal">
              resolved
            </v-chip>
          </div>
          <div class="text-body-2">{{ c.body }}</div>
          <v-btn
            v-if="c.assigned_to && !c.resolved_at"
            size="x-small"
            variant="text"
            @click="resolveComment(c)"
          >
            Mark resolved
          </v-btn>
        </div>
        <v-textarea
          v-model="newComment"
          auto-grow
          density="compact"
          placeholder="Write a comment…"
          rows="2"
          variant="outlined"
        />
        <v-btn color="primary" variant="flat" @click="addComment">Comment</v-btn>

        <v-divider class="my-4" />

        <!-- ACTIVITY -->
        <div class="text-subtitle-2 font-weight-bold mb-2">Activity</div>
        <div v-for="a in card.activity" :key="a.id" class="text-caption text-grey mb-1">
          {{ formatDateTime(a.created_at) }} — {{ a.summary }}
        </div>
      </v-card-text>

      <v-card-actions class="pa-4 bg-grey-lighten-4">
        <v-btn color="error" variant="text" @click="archiveCard">
          <v-icon start>mdi-archive</v-icon>
          Archive
        </v-btn>
        <v-spacer />
        <v-btn variant="outlined" @click="$emit('close')">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from "vue";
  import { useStore } from "vuex";
  import moment from "moment";
  import DateField from "@/components/shared/DateField.vue";
  import { formatDateTime, minutesToHuman } from "@/lib/boardFormat";

  const props = defineProps({
    cardId: { type: [Number, String, null], default: null },
    boardId: { type: [Number, String], required: true },
    statuses: { type: Array, default: () => [] },
    boardLabels: { type: Array, default: () => [] },
    cards: { type: Array, default: () => [] },
  });
  const emit = defineEmits(["close", "changed"]);

  const store = useStore();

  const card = ref(null);
  const userList = ref([]);

  const editTitle = ref("");
  const editDescription = ref("");
  const editStatusId = ref(null);
  const editPriority = ref(null);
  const editMilestone = ref(false);
  const editStart = ref("");
  const editDue = ref("");
  const editMembers = ref([]);
  const editTags = ref([]);

  const newItemText = ref({});
  const newSubtaskTitle = ref("");
  const blockerCardId = ref(null);
  const newLinkUrl = ref("");
  const newComment = ref("");
  const runningEntryId = ref(null);

  function toISO(displayDate) {
    if (!displayDate) return null;
    const m = moment(displayDate, "DD/MM/YYYY");
    return m.isValid() ? m.format("YYYY-MM-DD") : null;
  }

  function fromISO(value) {
    return value ? moment(value).format("DD/MM/YYYY") : "";
  }

  // The whole board's card list is already in memory (passed down from
  // Board.vue), so the dependency picker just filters it rather than a
  // separate request.
  const otherCards = computed(() =>
    props.cards.filter((c) => c.id !== Number(props.cardId)),
  );

  async function load() {
    if (!props.cardId) {
      card.value = null;
      return;
    }
    const res = await fetch(`/boards/cards/${props.cardId}`);
    const data = await res.json();
    card.value = data;
    editTitle.value = data.title;
    editDescription.value = data.description || "";
    editStatusId.value = data.status_id;
    editPriority.value = data.priority;
    editMilestone.value = data.is_milestone;
    editStart.value = fromISO(data.start_at);
    editDue.value = fromISO(data.due_at);
    editMembers.value = (data.members || []).map((m) => m.user_id);
    editTags.value = (data.tags || []).map((t) => t.name);
    runningEntryId.value = data.time_entries?.find((t) => !t.ended_at)?.id || null;
  }

  async function loadUsers() {
    const res = await fetch("/boards/users");
    const data = await res.json();
    userList.value = data.data || [];
  }

  async function saveField(field, value) {
    if (!card.value) return;
    await fetch(`/boards/cards/${props.cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await load();
    emit("changed");
  }

  function hasLabel(labelId) {
    return (card.value?.labels || []).some((l) => l.id === labelId);
  }

  async function toggleLabel(labelId) {
    const current = (card.value.labels || []).map((l) => l.id);
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    await fetch(`/boards/cards/${props.cardId}/labels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label_ids: next }),
    });
    await load();
    emit("changed");
  }

  async function saveMembers(ids) {
    await fetch(`/boards/cards/${props.cardId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: ids }),
    });
    await load();
    emit("changed");
  }

  async function saveTags(tags) {
    await fetch(`/boards/cards/${props.cardId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    emit("changed");
  }

  async function addChecklist() {
    await fetch(`/boards/cards/${props.cardId}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Checklist" }),
    });
    await load();
  }

  function checklistPct(cl) {
    if (!cl.items.length) return 0;
    return Math.round((cl.items.filter((i) => i.is_done).length / cl.items.length) * 100);
  }

  async function addItem(checklist) {
    const content = (newItemText.value[checklist.id] || "").trim();
    if (!content) return;
    await fetch(`/boards/checklists/${checklist.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    newItemText.value[checklist.id] = "";
    await load();
    emit("changed");
  }

  async function toggleItem(item, done) {
    await fetch(`/boards/checklist-items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: done }),
    });
    await load();
    emit("changed");
  }

  async function deleteItem(item) {
    await fetch(`/boards/checklist-items/${item.id}`, { method: "DELETE" });
    await load();
    emit("changed");
  }

  async function addSubtask() {
    const title = newSubtaskTitle.value.trim();
    if (!title) return;
    await fetch(`/boards/cards/${props.cardId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    newSubtaskTitle.value = "";
    await load();
    emit("changed");
  }

  async function addDependency() {
    if (!blockerCardId.value) return;
    const res = await fetch(`/boards/cards/${props.cardId}/dependencies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocker_card_id: blockerCardId.value }),
    });
    const data = await res.json();
    if (!res.ok) {
      store.commit("setMessage", { type: "error", text: data.error });
      return;
    }
    blockerCardId.value = null;
    await load();
  }

  async function removeDependency(blockerId) {
    await fetch(`/boards/cards/${props.cardId}/dependencies/${blockerId}`, { method: "DELETE" });
    await load();
  }

  async function startTimer() {
    const res = await fetch(`/boards/cards/${props.cardId}/timer/start`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      store.commit("setMessage", { type: "error", text: data.error });
      return;
    }
    runningEntryId.value = data.id;
    await load();
  }

  async function stopTimer() {
    await fetch(`/boards/time-entries/${runningEntryId.value}/stop`, { method: "POST" });
    runningEntryId.value = null;
    await load();
    emit("changed");
  }

  async function addLink() {
    if (!newLinkUrl.value.trim()) return;
    await fetch(`/boards/cards/${props.cardId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newLinkUrl.value.trim() }),
    });
    newLinkUrl.value = "";
    await load();
    emit("changed");
  }

  async function deleteLink(link) {
    await fetch(`/boards/links/${link.id}`, { method: "DELETE" });
    await load();
    emit("changed");
  }

  async function addComment() {
    if (!newComment.value.trim()) return;
    // Resolve "@Name" mentions against the board's people list.
    const mentioned = userList.value.filter((u) => newComment.value.includes(`@${u.name}`));
    await fetch(`/boards/cards/${props.cardId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: newComment.value.trim(),
        mentionStaffIds: mentioned.map((u) => u.id),
      }),
    });
    newComment.value = "";
    await load();
    emit("changed");
  }

  async function resolveComment(comment) {
    await fetch(`/boards/comments/${comment.id}/resolve`, { method: "POST" });
    await load();
  }

  async function archiveCard() {
    await fetch(`/boards/cards/${props.cardId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    });
    emit("changed");
    emit("close");
  }

  watch(() => props.cardId, load);
  onMounted(() => {
    load();
    loadUsers();
  });
</script>
