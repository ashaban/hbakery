<template>
  <v-dialog
    :fullscreen="mobile"
    :max-width="mobile ? undefined : 1360"
    :model-value="true"
    scrollable
    @update:model-value="emit('close')"
  >
    <v-card border :class="{ 'card-frame': !mobile }" rounded="lg">
      <div v-if="card?.cover_color" :style="{ background: card.cover_color, height: '48px' }" />

      <div v-if="loading" class="d-flex justify-center py-16">
        <v-progress-circular color="primary" indeterminate size="36" />
      </div>

      <template v-else-if="card">
        <v-card-title class="d-flex align-start ga-2 py-4">
          <v-icon class="mt-1 text-medium-emphasis" icon="mdi-card-text-outline" size="20" />
          <div class="flex-grow-1 min-w-0">
            <v-text-field
              v-if="editingTitle"
              v-model="titleDraft"
              autofocus
              density="compact"
              hide-details
              variant="outlined"
              @blur="saveTitle"
              @keyup.enter="saveTitle"
              @keyup.esc="editingTitle = false"
            />
            <div
              v-else
              class="text-h6"
              :class="{ 'cursor-text': canEdit }"
              @click="canEdit && (editingTitle = true)"
            >{{ card.title }}</div>
            <div class="text-caption text-medium-emphasis mt-1">
              in list <strong>{{ card.list_name }}</strong>
              <span v-if="card.created_by_name"> · added by {{ card.created_by_name }}</span>
              <span v-if="card.submitted_by_name"> · submitted by {{ card.submitted_by_name }}</span>
            </div>

            <div class="d-flex align-center flex-wrap ga-2 mt-2">
              <!-- Status is separate from the list: where it sits vs how
                   far along it is. -->
              <v-menu location="bottom start">
                <template #activator="{ props: p }">
                  <v-chip
                    v-bind="p"
                    :disabled="!canEdit"
                    label
                    size="small"
                    :style="currentStatus ? { color: currentStatus.color } : {}"
                    variant="tonal"
                  >
                    <v-icon icon="mdi-progress-check" size="14" start />
                    {{ currentStatus?.name || "No status" }}
                  </v-chip>
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="s in board.statuses"
                    :key="s.id"
                    :title="s.name"
                    @click="setStatus(s.id)"
                  >
                    <template #prepend>
                      <span class="status-dot mr-3" :style="{ background: s.color }" />
                    </template>
                    <template #append>
                      <v-icon
                        v-if="s.id === card.status_id"
                        color="success"
                        icon="mdi-check"
                        size="16"
                      />
                    </template>
                  </v-list-item>
                </v-list>
              </v-menu>

              <v-menu location="bottom start">
                <template #activator="{ props: p }">
                  <v-chip
                    v-bind="p"
                    :disabled="!canEdit"
                    label
                    size="small"
                    :style="currentPriority ? { color: currentPriority.color } : {}"
                    variant="tonal"
                  >
                    <v-icon :icon="currentPriority?.icon || 'mdi-flag-outline'" size="14" start />
                    {{ currentPriority?.label || "Priority" }}
                  </v-chip>
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="p in PRIORITIES"
                    :key="p.value"
                    :title="p.label"
                    @click="setPriority(card.priority === p.value ? null : p.value)"
                  >
                    <template #prepend>
                      <v-icon class="mr-3" :color="p.color" :icon="p.icon" size="16" />
                    </template>
                    <template #append>
                      <v-icon
                        v-if="card.priority === p.value"
                        color="success"
                        icon="mdi-check"
                        size="16"
                      />
                    </template>
                  </v-list-item>
                </v-list>
              </v-menu>

              <v-chip
                :color="card.is_milestone ? 'warning' : undefined"
                :disabled="!canEdit"
                label
                size="small"
                variant="tonal"
                @click="canEdit && toggleMilestone()"
              >
                <v-icon
                  :icon="card.is_milestone ? 'mdi-rhombus' : 'mdi-rhombus-outline'"
                  size="13"
                  start
                />
                Milestone
              </v-chip>

              <v-chip
                v-if="card.blocked_by?.some((b) => b.status_category !== 'DONE')"
                color="error"
                label
                size="small"
                variant="tonal"
              >
                <v-icon icon="mdi-block-helper" size="13" start />Blocked
              </v-chip>
            </div>
          </div>
          <v-btn icon="mdi-close" size="small" variant="text" @click="emit('close')" />
        </v-card-title>

        <v-divider />

        <v-card-text class="pt-5" :class="{ 'card-body': !mobile }">
          <v-row :class="{ 'card-row': !mobile }">
            <!-- Main column ------------------------------------------ -->
            <v-col class="card-main" cols="12" md="7">
              <div
                v-if="card.labels.length || card.members.length || card.start_at || card.due_at"
                class="d-flex flex-wrap ga-6 mb-5"
              >
                <div v-if="card.members.length">
                  <div class="eyebrow mb-2">Assigned to</div>
                  <div class="d-flex ga-1">
                    <StaffAvatar
                      v-for="m in card.members"
                      :key="m.staff_id"
                      :name="m.full_name"
                      :size="34"
                    />
                  </div>
                </div>
                <div v-if="card.labels.length">
                  <div class="eyebrow mb-2">Labels</div>
                  <div class="d-flex flex-wrap ga-1">
                    <span
                      v-for="l in card.labels"
                      :key="l.id"
                      class="card-label"
                      :style="{ background: l.color }"
                    >{{ l.name || "&nbsp;&nbsp;&nbsp;" }}</span>
                  </div>
                </div>
                <div v-if="card.start_at">
                  <div class="eyebrow mb-2">Starts</div>
                  <v-chip label size="small" variant="tonal">
                    <v-icon icon="mdi-calendar-start-outline" size="15" start />
                    {{ formatDateTime(card.start_at) }}
                  </v-chip>
                </div>
                <div v-if="card.due_at">
                  <div class="eyebrow mb-2">Due</div>
                  <v-chip
                    :color="card.due_complete ? 'success' : undefined"
                    :disabled="!canEdit"
                    label
                    size="small"
                    variant="tonal"
                    @click="canEdit && toggleDueComplete()"
                  >
                    <v-icon
                      :icon="card.due_complete ? 'mdi-checkbox-marked-outline' : 'mdi-checkbox-blank-outline'"
                      size="15"
                      start
                    />
                    {{ formatDateTime(card.due_at) }}
                  </v-chip>
                </div>
              </div>

              <div class="eyebrow mb-2">Description</div>
              <div v-if="editingDescription">
                <v-alert
                  v-if="staleWarning"
                  class="mb-2"
                  density="compact"
                  rounded="lg"
                  type="warning"
                  variant="tonal"
                >
                  <div class="text-body-2 font-weight-bold">
                    Someone else edited this description while you were typing
                  </div>
                  <div class="d-flex ga-2 mt-2">
                    <v-btn size="x-small" variant="tonal" @click="reloadAndKeepDraft">
                      Show me theirs
                    </v-btn>
                    <v-btn color="error" size="x-small" variant="tonal" @click="overwriteAnyway">
                      Keep mine
                    </v-btn>
                  </div>
                </v-alert>
                <v-textarea v-model="descriptionDraft" auto-grow rows="5" variant="outlined" />
                <div class="d-flex ga-2 mt-2">
                  <v-btn color="primary" flat :loading="savingDescription" size="small" @click="saveDescription">
                    Save
                  </v-btn>
                  <v-btn size="small" variant="text" @click="editingDescription = false">Cancel</v-btn>
                </div>
              </div>
              <div
                v-else
                class="card-description"
                :class="{ 'cursor-text': canEdit }"
                @click="canEdit && (editingDescription = true)"
              >
                <div v-if="card.description" class="text-body-2 description-text">
                  {{ card.description }}
                </div>
                <span v-else class="text-caption text-medium-emphasis">
                  {{ canEdit ? "Add a more detailed description…" : "No description" }}
                </span>
              </div>

              <v-btn
                v-if="mobile && !showAllSections"
                block
                class="mt-5"
                prepend-icon="mdi-chevron-down"
                size="small"
                variant="tonal"
                @click="showAllSections = true"
              >
                More — subtasks, checklists, links, time…
              </v-btn>

              <template v-if="detailShown">
                <div class="eyebrow mt-6 mb-2">Subtasks</div>
                <SubtaskPanel
                  :can-edit="canEdit"
                  :card-id="cardId"
                  :subtasks="card.subtasks || []"
                  @changed="reloadCollab"
                  @open="(id) => emit('open-card', id)"
                />

                <div class="eyebrow mt-6 mb-2">Dependencies</div>
                <DependencyPanel
                  :blocked-by="card.blocked_by || []"
                  :blocking="card.blocking || []"
                  :can-edit="canEdit"
                  :card-id="cardId"
                  @changed="reloadCollab"
                  @open="(id) => emit('open-card', id)"
                />

                <div class="eyebrow mt-6 mb-2">Checklists</div>
                <ChecklistPanel
                  :can-edit="canEdit"
                  :card-id="cardId"
                  :checklists="card.checklists || []"
                  :members="board.members"
                  @changed="reloadCollab"
                />

                <div class="eyebrow mt-6 mb-2">Fields</div>
                <CustomFieldsPanel
                  :can-edit="canEdit"
                  :card-id="cardId"
                  :values="card.custom || {}"
                  @changed="reloadCollab"
                />

                <div class="eyebrow mt-6 mb-2">Tags</div>
                <div class="d-flex flex-wrap ga-2 align-center">
                  <v-chip
                    v-for="t in card.tags || []"
                    :key="t.id"
                    :closable="canEdit"
                    label
                    size="small"
                    :style="{ color: t.color }"
                    variant="tonal"
                    @click:close="removeTag(t)"
                  >{{ t.name }}</v-chip>
                  <v-combobox
                    v-if="canEdit"
                    v-model="newTag"
                    density="compact"
                    hide-details
                    :items="allTags.map((t) => t.name)"
                    placeholder="Add a tag"
                    style="max-width: 200px"
                    @update:model-value="addTag"
                  />
                </div>

                <template v-if="card.linked_boards?.length">
                  <div class="eyebrow mt-6 mb-2">Boards addressing this task</div>
                  <div v-for="b in card.linked_boards" :key="b.id" class="linked-row">
                    <v-icon
                      class="text-medium-emphasis"
                      icon="mdi-view-column-outline"
                      size="16"
                    />
                    <router-link
                      class="text-body-2 linked-row__link"
                      :to="{ name: 'Board', query: { id: b.id } }"
                    >{{ b.name }}</router-link>
                    <v-chip v-if="b.is_archived" size="x-small" variant="tonal">Archived</v-chip>
                  </div>
                </template>

                <div class="eyebrow mt-6 mb-2">Time</div>
                <TimeTracker
                  :can-edit="canEdit"
                  :card-id="cardId"
                  :estimate="card.estimate_minutes"
                  :time="card.time"
                  @changed="reloadCollab"
                />

                <div class="eyebrow mt-6 mb-2">Repeat</div>
                <RecurrencePicker
                  :can-edit="canEdit"
                  :card-id="cardId"
                  :recurrence="card.recurrence"
                  @changed="reloadCollab"
                />

                <!-- hbakery has no file storage, so a card carries links
                     (Drive, a shared photo) rather than uploads. -->
                <div class="eyebrow mt-6 mb-2">Links</div>
                <div v-if="card.attachments?.length" class="mb-2">
                  <div v-for="a in card.attachments" :key="a.id" class="attachment d-flex align-center ga-3">
                    <v-icon class="text-medium-emphasis" icon="mdi-link-variant" size="20" />
                    <div class="flex-grow-1 min-w-0">
                      <a class="text-body-2 linked-row__link" :href="a.url" rel="noopener" target="_blank">
                        {{ a.label || a.url }}
                      </a>
                      <div class="text-caption text-medium-emphasis">
                        {{ a.added_by_name }} · {{ relativeTime(a.added_at) }}
                      </div>
                    </div>
                    <v-btn
                      v-if="canEdit"
                      icon="mdi-delete-outline"
                      size="x-small"
                      variant="text"
                      @click="removeLink(a)"
                    />
                  </div>
                </div>
                <div v-if="canEdit" class="d-flex ga-2">
                  <v-text-field
                    v-model="newLink.url"
                    density="compact"
                    hide-details
                    placeholder="Paste a link"
                    variant="outlined"
                  />
                  <v-text-field
                    v-model="newLink.label"
                    density="compact"
                    hide-details
                    placeholder="Label (optional)"
                    style="max-width: 180px"
                    variant="outlined"
                  />
                  <v-btn color="primary" flat size="small" @click="addLink">Add</v-btn>
                </div>

                <v-btn
                  v-if="mobile"
                  block
                  class="mt-4"
                  prepend-icon="mdi-chevron-up"
                  size="small"
                  variant="text"
                  @click="showAllSections = false"
                >Show less</v-btn>
              </template>
            </v-col>

            <!-- Sidebar: quick fields, actions, then the conversation —
                 so the thread is always visible alongside the card
                 rather than at the bottom of a long scroll. --------- -->
            <v-col class="card-side" cols="12" md="5">
              <div class="eyebrow mb-2">Add to card</div>

              <v-menu :close-on-content-click="false" location="bottom end">
                <template #activator="{ props: p }">
                  <v-btn
                    v-bind="p"
                    block
                    class="mb-2 justify-start"
                    :disabled="!canEdit"
                    prepend-icon="mdi-account-outline"
                    size="small"
                    variant="tonal"
                  >Assign</v-btn>
                </template>
                <v-card border min-width="250" rounded="lg">
                  <v-list density="compact">
                    <v-list-item
                      v-for="m in board.members"
                      :key="m.staff_id"
                      :title="m.full_name"
                      @click="toggleMember(m)"
                    >
                      <template #prepend>
                        <StaffAvatar class="mr-2" :name="m.full_name" :size="28" :tooltip="false" />
                      </template>
                      <template #append>
                        <v-icon
                          v-if="assignedIds.has(m.staff_id)"
                          color="success"
                          icon="mdi-check"
                          size="18"
                        />
                      </template>
                    </v-list-item>
                  </v-list>
                </v-card>
              </v-menu>

              <v-menu :close-on-content-click="false" location="bottom end">
                <template #activator="{ props: p }">
                  <v-btn
                    v-bind="p"
                    block
                    class="mb-2 justify-start"
                    :disabled="!canEdit"
                    prepend-icon="mdi-label-outline"
                    size="small"
                    variant="tonal"
                  >Labels</v-btn>
                </template>
                <v-card border min-width="270" rounded="lg">
                  <v-list density="compact">
                    <v-list-item v-for="l in board.labels" :key="l.id" @click="toggleLabel(l)">
                      <template #prepend>
                        <span
                          class="card-label mr-3"
                          :style="{ background: l.color, minWidth: '52px' }"
                        />
                      </template>
                      <v-list-item-title class="text-body-2">
                        {{ l.name || "No name" }}
                      </v-list-item-title>
                      <template #append>
                        <v-icon
                          v-if="appliedLabelIds.has(l.id)"
                          color="success"
                          icon="mdi-check"
                          size="18"
                        />
                      </template>
                    </v-list-item>
                  </v-list>
                  <v-divider />
                  <div class="pa-3">
                    <div class="eyebrow mb-2">New label</div>
                    <v-text-field
                      v-model="newLabel.name"
                      class="mb-2"
                      density="compact"
                      hide-details
                      placeholder="Name (optional)"
                    />
                    <div class="d-flex flex-wrap ga-1 mb-2">
                      <button
                        v-for="c in LABEL_COLORS"
                        :key="c"
                        class="swatch"
                        :class="{ 'swatch--on': newLabel.color === c }"
                        :style="{ background: c }"
                        @click="newLabel.color = c"
                      />
                    </div>
                    <v-btn block color="primary" flat size="small" @click="createLabel">
                      Create label
                    </v-btn>
                  </div>
                </v-card>
              </v-menu>

              <v-menu :close-on-content-click="false" location="bottom end">
                <template #activator="{ props: p }">
                  <v-btn
                    v-bind="p"
                    block
                    class="mb-2 justify-start"
                    :disabled="!canEdit"
                    prepend-icon="mdi-clock-outline"
                    size="small"
                    variant="tonal"
                  >Dates</v-btn>
                </template>
                <v-card border class="pa-3" min-width="280" rounded="lg">
                  <div class="eyebrow mb-2">Starts</div>
                  <input v-model="startLocal" class="due-input" type="datetime-local">
                  <v-btn
                    v-if="card.start_at"
                    block
                    class="mt-1"
                    size="x-small"
                    variant="text"
                    @click="setStart('')"
                  >Clear start date</v-btn>

                  <div class="eyebrow mt-3 mb-2">Due</div>
                  <input v-model="dueLocal" class="due-input" type="datetime-local">
                  <v-btn
                    v-if="card.due_at"
                    block
                    class="mt-1"
                    size="x-small"
                    variant="text"
                    @click="setDue('')"
                  >Clear due date</v-btn>

                  <div class="text-caption text-medium-emphasis mt-3">
                    A start date makes this card a bar on the timeline.
                  </div>
                </v-card>
              </v-menu>

              <v-menu :close-on-content-click="false" location="bottom end">
                <template #activator="{ props: p }">
                  <v-btn
                    v-bind="p"
                    block
                    class="mb-2 justify-start"
                    :disabled="!canEdit"
                    prepend-icon="mdi-palette-outline"
                    size="small"
                    variant="tonal"
                  >Cover</v-btn>
                </template>
                <v-card border class="pa-3" rounded="lg">
                  <div class="d-flex flex-wrap ga-1" style="max-width: 200px">
                    <button
                      v-for="c in COVER_COLORS"
                      :key="c || 'none'"
                      class="swatch"
                      :class="{ 'swatch--on': card.cover_color === c, 'swatch--none': !c }"
                      :style="c ? { background: c } : {}"
                      @click="setCover(c)"
                    />
                  </div>
                </v-card>
              </v-menu>

              <div class="eyebrow mt-5 mb-2">Actions</div>
              <v-btn
                block
                class="mb-2 justify-start"
                :prepend-icon="card.watching ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                size="small"
                variant="tonal"
                @click="toggleWatch"
              >
                {{ card.watching ? "Stop watching" : "Watch" }}
              </v-btn>
              <v-btn
                v-if="canEdit"
                block
                class="mb-2 justify-start"
                prepend-icon="mdi-content-copy"
                size="small"
                variant="tonal"
                @click="copyCard"
              >Copy card</v-btn>
              <v-btn
                v-if="canEdit"
                block
                class="justify-start"
                color="error"
                prepend-icon="mdi-archive-outline"
                size="small"
                variant="tonal"
                @click="archive"
              >Archive</v-btn>

              <v-divider class="my-5" />

              <div class="eyebrow mb-2">Comments</div>
              <CommentBox
                :card-id="cardId"
                :comments="card.comments || []"
                :members="board.members"
                @changed="reloadCollab"
              />

              <template v-if="detailShown">
                <div class="eyebrow mt-6 mb-2">Activity</div>
                <div class="card-activity">
                  <div v-for="a in card.activity" :key="a.id" class="activity-row">
                    <span class="activity-dot" />
                    <div>
                      <div class="text-body-2">{{ a.summary }}</div>
                      <div class="text-caption text-medium-emphasis">
                        {{ relativeTime(a.created_at) }}
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </v-col>
          </v-row>
        </v-card-text>
      </template>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { computed, onMounted, ref, watch } from "vue";
  import { useDisplay } from "vuetify";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import ChecklistPanel from "./ChecklistPanel.vue";
  import CommentBox from "./CommentBox.vue";
  import SubtaskPanel from "./SubtaskPanel.vue";
  import DependencyPanel from "./DependencyPanel.vue";
  import CustomFieldsPanel from "./CustomFieldsPanel.vue";
  import TimeTracker from "./TimeTracker.vue";
  import RecurrencePicker from "./RecurrencePicker.vue";
  import {
    formatDateTime, LABEL_COLORS, PRIORITIES, priorityMeta, relativeTime, toLocalInput,
  } from "@/lib/boards";

  /** The "back" of a card. */
  const props = defineProps({ cardId: { type: [String, Number], required: true } });
  const emit = defineEmits(["close", "changed", "open-card"]);

  const { mobile } = useDisplay();
  const board = useBoard();
  const store = useStore();

  /**
   * A card back is a dozen sections tall. On a phone that is nearly two
   * thousand pixels of scrolling before the comments, which is where most
   * conversation happens. So on mobile only the parts people open a card
   * *for* — description and comments — are shown, and the rest sits
   * behind "More".
   */
  const showAllSections = ref(false);
  const detailShown = computed(() => !mobile.value || showAllSections.value);

  const card = ref(null);
  const loading = ref(true);
  const savingDescription = ref(false);
  const staleWarning = ref(false);

  const titleDraft = ref("");
  const editingTitle = ref(false);
  const descriptionDraft = ref("");
  const editingDescription = ref(false);

  const COVER_COLORS = [null, ...LABEL_COLORS];
  const newLabel = ref({ name: "", color: LABEL_COLORS[0] });
  const newTag = ref("");
  const allTags = ref([]);
  const newLink = ref({ url: "", label: "" });

  const canEdit = computed(() => board.canEdit);
  const appliedLabelIds = computed(() => new Set((card.value?.labels || []).map((l) => l.id)));
  const assignedIds = computed(() => new Set((card.value?.members || []).map((m) => m.staff_id)));

  const fail = (err) =>
    store.commit("setMessage", { type: "error", text: err.message || "Something went wrong" });

  const dueLocal = computed({
    get: () => toLocalInput(card.value?.due_at),
    set: (v) => setDue(v),
  });

  /**
   * A start date is what turns a card into a bar on the timeline. Without
   * one a card can only be a point, so the Gantt view needs this control.
   */
  const startLocal = computed({
    get: () => toLocalInput(card.value?.start_at),
    set: (v) => setStart(v),
  });

  async function load() {
    loading.value = true;
    try {
      card.value = await board.api.get(`/boards/cards/${props.cardId}`);
      titleDraft.value = card.value.title;
      descriptionDraft.value = card.value.description || "";
    } catch (err) {
      fail(err);
      emit("close");
    } finally {
      loading.value = false;
    }
  }

  /** Writes a patch, then mirrors it onto the board so the tile updates behind. */
  async function patch(body, mirror = body) {
    try {
      const saved = await board.api.put(`/boards/cards/${props.cardId}`, body);
      Object.assign(card.value, saved);
      board.patchCard(Number(props.cardId), {
        ...mirror,
        has_description: Boolean(saved.description),
      });
      emit("changed");
      return saved;
    } catch (err) {
      // A stale-edit conflict is handled by the caller with a real choice.
      if (err?.details?.reason !== "stale") fail(err);
      throw err;
    }
  }

  async function saveTitle() {
    editingTitle.value = false;
    const title = titleDraft.value.trim();
    if (!title || title === card.value.title) {
      titleDraft.value = card.value.title;
      return;
    }
    await patch({ title }, { title });
  }

  async function saveDescription() {
    savingDescription.value = true;
    try {
      // The description is the one field where two people can lose real
      // work, so it is the one that checks whether the card moved on
      // while it was open.
      await patch({
        description: descriptionDraft.value,
        expected_updated_at: card.value.updated_at,
      });
      editingDescription.value = false;
    } catch (err) {
      if (err?.details?.reason === "stale") staleWarning.value = true;
    } finally {
      savingDescription.value = false;
    }
  }

  async function reloadAndKeepDraft() {
    // Their text is kept in the editor; only the saved copy is re-read,
    // so nothing typed is lost while the two versions are compared.
    const mine = descriptionDraft.value;
    await load();
    descriptionDraft.value = mine;
    editingDescription.value = true;
    staleWarning.value = false;
    store.commit("setMessage", {
      type: "warning",
      text: "Reloaded — your text is still here",
    });
  }

  async function overwriteAnyway() {
    staleWarning.value = false;
    await load();
    savingDescription.value = true;
    try {
      await patch({ description: descriptionDraft.value });
      editingDescription.value = false;
    } catch {
      // Reported by patch.
    } finally {
      savingDescription.value = false;
    }
  }

  async function setDue(local) {
    const due_at = local ? new Date(local).toISOString() : null;
    await patch({ due_at }, { due_at, due_complete: false });
  }

  async function setStart(local) {
    const start_at = local ? new Date(local).toISOString() : null;
    await patch({ start_at }, { start_at });
  }

  const toggleDueComplete = () =>
    patch({ due_complete: !card.value.due_complete }, { due_complete: !card.value.due_complete });

  const setCover = (color) => patch({ cover_color: color }, { cover_color: color });

  const currentStatus = computed(
    () => board.statuses.find((s) => s.id === card.value?.status_id) || null,
  );
  const currentPriority = computed(() => priorityMeta(card.value?.priority));

  async function setStatus(statusId, force = false) {
    try {
      const saved = await board.api.put(`/boards/cards/${props.cardId}`, {
        status_id: statusId,
        ...(force ? { force: true } : {}),
      });
      Object.assign(card.value, saved);
      board.patchCard(Number(props.cardId), { status_id: statusId });
      // Completing a card can unblock others, so the board is re-read.
      await board.refresh();
      emit("changed");
    } catch (err) {
      // 409 means the card is still waiting on something. Completing
      // anyway is a legitimate call, but it should be a decision rather
      // than an accident.
      if (err?.status === 409 && err.details?.blocked_by) {
        const blockers = err.details.blocked_by.map((t) => `"${t}"`).join(", ");
        if (window.confirm(`This card is still waiting on ${blockers}.\n\nComplete it anyway?`)) {
          return setStatus(statusId, true);
        }
        return;
      }
      fail(err);
    }
  }

  const setPriority = (value) => patch({ priority: value }, { priority: value });
  const toggleMilestone = () =>
    patch({ is_milestone: !card.value.is_milestone }, { is_milestone: !card.value.is_milestone });

  async function toggleLabel(label) {
    const applied = appliedLabelIds.value.has(label.id);
    try {
      const path = `/boards/cards/${props.cardId}/labels/${label.id}`;
      if (applied) await board.api.del(path);
      else await board.api.post(path);
      card.value.labels = applied
        ? card.value.labels.filter((l) => l.id !== label.id)
        : [...card.value.labels, label];
      board.patchCard(Number(props.cardId), {
        label_ids: card.value.labels.map((l) => l.id),
      });
      emit("changed");
    } catch (err) {
      fail(err);
    }
  }

  async function createLabel() {
    if (!newLabel.value.color) return;
    try {
      const label = await board.api.post(`/boards/${board.board.id}/labels`, newLabel.value);
      board.board.labels.push(label);
      newLabel.value = { name: "", color: LABEL_COLORS[0] };
      await toggleLabel(label);
    } catch (err) {
      fail(err);
    }
  }

  async function toggleMember(member) {
    const assigned = assignedIds.value.has(member.staff_id);
    try {
      const path = `/boards/cards/${props.cardId}/members/${member.staff_id}`;
      if (assigned) await board.api.del(path);
      else await board.api.post(path);
      card.value.members = assigned
        ? card.value.members.filter((m) => m.staff_id !== member.staff_id)
        : [...card.value.members, { staff_id: member.staff_id, full_name: member.full_name }];
      board.patchCard(Number(props.cardId), {
        member_ids: card.value.members.map((m) => m.staff_id),
      });
      emit("changed");
    } catch (err) {
      fail(err);
    }
  }

  async function toggleWatch() {
    const watching = !card.value.watching;
    try {
      const path = `/boards/cards/${props.cardId}/watch`;
      if (watching) await board.api.post(path);
      else await board.api.del(path);
      card.value.watching = watching;
      board.patchCard(Number(props.cardId), { watching });
    } catch (err) {
      fail(err);
    }
  }

  async function loadTags() {
    try {
      allTags.value = await board.api.get("/boards/tags");
    } catch {
      // The picker simply offers nothing.
    }
  }

  async function addTag(name) {
    const value = String(name || "").trim();
    if (!value) return;
    try {
      card.value.tags = await board.api.post(`/boards/cards/${props.cardId}/tags`, { name: value });
      newTag.value = "";
      await loadTags();
      emit("changed");
    } catch (err) {
      fail(err);
    }
  }

  async function removeTag(tag) {
    try {
      card.value.tags = await board.api.del(`/boards/cards/${props.cardId}/tags/${tag.id}`);
      emit("changed");
    } catch (err) {
      fail(err);
    }
  }

  async function addLink() {
    if (!newLink.value.url.trim()) return;
    try {
      await board.api.post(`/boards/cards/${props.cardId}/links`, newLink.value);
      newLink.value = { url: "", label: "" };
      await reloadCollab();
    } catch (err) {
      fail(err);
    }
  }

  async function removeLink(link) {
    try {
      await board.api.del(`/boards/cards/${props.cardId}/links/${link.id}`);
      await reloadCollab();
    } catch (err) {
      fail(err);
    }
  }

  /** Re-reads the card after a checklist, comment or link change. */
  async function reloadCollab() {
    const fresh = await board.api.get(`/boards/cards/${props.cardId}`);
    card.value = fresh;
    board.patchCard(Number(props.cardId), {
      comment_count: fresh.comments.filter((c) => !c.is_deleted).length,
      attachment_count: fresh.attachments.length,
      checklist_total: fresh.checklists.reduce((n, l) => n + l.items.length, 0),
      checklist_done: fresh.checklists.reduce(
        (n, l) => n + l.items.filter((i) => i.is_done).length,
        0,
      ),
      subtask_total: fresh.subtasks.length,
      subtask_done: fresh.subtasks.filter((s) => s.status_category === "DONE").length,
      is_blocked: fresh.blocked_by.some((b) => b.status_category !== "DONE"),
      custom: fresh.custom,
      estimate_minutes: fresh.estimate_minutes,
      tags: fresh.tags,
    });
    emit("changed");
  }

  async function copyCard() {
    const title = window.prompt("Title for the copy", `${card.value.title} (copy)`);
    if (title === null) return;
    try {
      const fresh = await board.api.post(`/boards/cards/${props.cardId}/copy`, { title });
      await board.refresh();
      store.commit("setMessage", { type: "success", text: "Card copied" });
      emit("open-card", fresh.id);
    } catch (err) {
      fail(err);
    }
  }

  async function archive() {
    if (!window.confirm("Archive this card? You can restore it from the board archive.")) return;
    try {
      await board.archiveCard(Number(props.cardId));
      store.commit("setMessage", { type: "success", text: "Card archived" });
      emit("close");
    } catch (err) {
      fail(err);
    }
  }

  watch(() => props.cardId, load);
  onMounted(() => {
    load();
    loadTags();
  });
</script>

<style scoped>
.cursor-text {
  cursor: text;
}
.min-w-0 {
  min-width: 0;
}
.eyebrow {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.55);
}
.card-label {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  padding: 4px 9px;
  border-radius: 4px;
}
.card-description {
  min-height: 56px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px;
  margin-left: -8px;
}
.card-description.cursor-text:hover {
  border-color: rgba(0, 0, 0, 0.15);
  background: rgba(0, 0, 0, 0.02);
}
.description-text {
  white-space: pre-wrap;
}
.swatch {
  width: 42px;
  height: 26px;
  border-radius: 5px;
  border: 2px solid transparent;
  cursor: pointer;
}
.swatch--on {
  border-color: rgba(0, 0, 0, 0.8);
}
.swatch--none {
  background: repeating-linear-gradient(45deg, #ddd 0 6px, #fff 6px 12px);
}
.due-input {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 8px;
  font: inherit;
  color: inherit;
  background: transparent;
}
.card-activity {
  max-height: 300px;
  overflow-y: auto;
}
.activity-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 4px 0;
}
.activity-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  margin-top: 7px;
  flex: 0 0 auto;
}
.linked-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.linked-row__link {
  color: inherit;
  text-decoration: none;
}
.linked-row__link:hover {
  color: rgb(var(--v-theme-primary));
}
.attachment {
  padding: 4px 0;
}
.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
}

/*
 * On desktop the card gets a fixed height with two independently
 * scrolling panes — the description/checklists side and the comment
 * thread side each scroll on their own, rather than one long page where
 * the conversation is always at the bottom.
 *
 * Mobile is untouched: the dialog is fullscreen there and the whole page
 * scrolls as one, which is what the "More" collapse is built for.
 */
.card-frame {
  height: 88vh;
  max-height: 900px;
  display: flex;
  flex-direction: column;
}
.card-frame :deep(.v-card-title) {
  flex: 0 0 auto;
}
.card-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding-bottom: 0 !important;
}
.card-row {
  height: 100%;
  flex-wrap: nowrap;
}
/*
 * The split-pane treatment only makes sense once the two columns
 * actually sit side by side — below md they stack full-width, and the
 * divider would otherwise show up as a stray line with nothing beside it.
 */
@media (min-width: 960px) {
  .card-main,
  .card-side {
    height: 100%;
    overflow-y: auto;
    padding-bottom: 24px;
  }
  .card-main {
    border-right: 1px solid rgba(0, 0, 0, 0.12);
  }
  .card-side {
    padding-left: 20px;
  }
}
</style>
