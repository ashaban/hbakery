<template>
  <div>
    <!-- Composer: text, an optional "for someone", and @mentions. -->
    <div class="mb-3">
      <v-textarea
        v-model="draft"
        auto-grow
        density="compact"
        hide-details
        placeholder="Write a comment… use @ to mention someone"
        rows="2"
        variant="outlined"
      />
      <div class="d-flex align-center flex-wrap ga-2 mt-2">
        <v-autocomplete
          v-model="assignTo"
          clearable
          density="compact"
          hide-details
          item-title="full_name"
          item-value="staff_id"
          :items="members"
          placeholder="Ask someone to act (optional)"
          style="max-width: 240px"
        />
        <v-spacer />
        <v-btn color="primary" :disabled="!draft.trim()" flat size="small" @click="post">
          Comment
        </v-btn>
      </div>
    </div>

    <!--
      One thread per top-level comment, with its replies indented under
      it. The same partial renders both, so a reply looks like what it is.
    -->
    <div v-for="c in comments" :key="c.id" class="mt-4">
      <div class="d-flex ga-3">
        <StaffAvatar :name="c.author_name" :size="34" />
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex align-center flex-wrap ga-2">
            <span class="text-body-2 font-weight-bold">{{ c.author_name }}</span>
            <span class="text-caption text-medium-emphasis">{{ relativeTime(c.created_at) }}</span>
            <span
              v-if="c.updated_at !== c.created_at && !c.is_deleted"
              class="text-caption text-medium-emphasis"
            >(edited)</span>
            <v-chip
              v-if="c.assigned_to_id"
              :color="c.resolved_at ? 'success' : 'warning'"
              label
              size="x-small"
              variant="tonal"
            >
              <v-icon
                :icon="c.resolved_at ? 'mdi-check-circle-outline' : 'mdi-account-alert-outline'"
                size="12"
                start
              />
              {{ c.resolved_at ? `Resolved by ${c.resolved_by_name}` : `For ${c.assigned_to_name}` }}
            </v-chip>
          </div>

          <div v-if="c.is_deleted" class="text-caption text-medium-emphasis mt-1 font-italic">
            This comment was deleted by {{ c.deleted_by_name || "a member" }}
            · {{ relativeTime(c.deleted_at) }}
          </div>

          <template v-else>
            <div v-if="editing === c.id" class="mt-1">
              <v-textarea
                v-model="editDraft"
                auto-grow
                autofocus
                density="compact"
                hide-details
                rows="2"
                variant="outlined"
              />
              <div class="d-flex ga-2 mt-2">
                <v-btn color="primary" flat size="small" @click="saveEdit(c)">Save</v-btn>
                <v-btn size="small" variant="text" @click="editing = null">Cancel</v-btn>
              </div>
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else class="comment-body mt-1" v-html="render(c)" />

            <div v-if="c.reactions?.length" class="d-flex flex-wrap ga-1 mt-1">
              <v-chip
                v-for="r in c.reactions"
                :key="r.emoji"
                :color="r.staff_ids.includes(board.viewerId) ? 'primary' : undefined"
                label
                size="x-small"
                :title="r.names.join(', ')"
                :variant="r.staff_ids.includes(board.viewerId) ? 'flat' : 'tonal'"
                @click="react(c, r.emoji)"
              >
                {{ r.emoji }} {{ r.count }}
              </v-chip>
            </div>

            <div v-if="editing !== c.id" class="d-flex align-center ga-1 mt-1">
              <v-menu location="bottom start">
                <template #activator="{ props: p }">
                  <v-btn v-bind="p" icon="mdi-emoticon-outline" size="x-small" variant="text" />
                </template>
                <v-card border class="pa-2 d-flex align-center ga-1" rounded="lg">
                  <v-btn
                    v-for="e in QUICK_REACTIONS"
                    :key="e"
                    :color="iReacted(c, e) ? 'primary' : undefined"
                    size="small"
                    variant="text"
                    @click="react(c, e)"
                  >{{ e }}</v-btn>
                </v-card>
              </v-menu>
              <v-btn size="x-small" variant="text" @click="startReply(c)">Reply</v-btn>
              <v-btn
                v-if="c.assigned_to_id"
                :prepend-icon="c.resolved_at ? 'mdi-undo' : 'mdi-check'"
                size="x-small"
                variant="text"
                @click="toggleResolved(c)"
              >{{ c.resolved_at ? "Reopen" : "Mark resolved" }}</v-btn>
              <v-btn v-if="canEdit(c)" size="x-small" variant="text" @click="startEdit(c)">Edit</v-btn>
              <v-btn v-if="canDelete(c)" size="x-small" variant="text" @click="remove(c)">Delete</v-btn>
            </div>
          </template>
        </div>
      </div>

      <!-- Replies, indented to line up under the parent's text. -->
      <div v-if="c.replies?.length || replyingTo === c.id" class="comment-replies">
        <div v-for="r in c.replies" :key="r.id" class="d-flex ga-3 mt-3">
          <StaffAvatar :name="r.author_name" :size="26" />
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex align-center flex-wrap ga-2">
              <span class="text-body-2 font-weight-bold">{{ r.author_name }}</span>
              <span class="text-caption text-medium-emphasis">{{ relativeTime(r.created_at) }}</span>
            </div>
            <div v-if="r.is_deleted" class="text-caption text-medium-emphasis font-italic">
              This reply was deleted
            </div>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div v-else class="comment-body" v-html="render(r)" />
            <div v-if="!r.is_deleted && canDelete(r)" class="d-flex ga-1">
              <v-btn size="x-small" variant="text" @click="remove(r)">Delete</v-btn>
            </div>
          </div>
        </div>

        <div v-if="replyingTo === c.id" class="d-flex ga-2 mt-2">
          <v-text-field
            v-model="replyDraft"
            autofocus
            density="compact"
            hide-details
            placeholder="Write a reply…"
            variant="outlined"
            @keyup.enter="postReply(c)"
          />
          <v-btn color="primary" flat size="small" @click="postReply(c)">Reply</v-btn>
          <v-btn size="small" variant="text" @click="replyingTo = null">Cancel</v-btn>
        </div>
      </div>
    </div>

    <div v-if="!comments.length" class="text-caption text-medium-emphasis mt-2">
      No comments yet.
    </div>
  </div>
</template>

<script setup>
  import { onMounted, ref } from "vue";
  import { useStore } from "vuex";
  import { useBoard } from "@/stores/board";
  import StaffAvatar from "@/components/StaffAvatar.vue";
  import { relativeTime } from "@/lib/boards";

  /**
   * The comment thread. Replies, reactions, mentions and assigned
   * comments ("for X, until they mark it resolved") all live here.
   */
  const props = defineProps({
    cardId: { type: [String, Number], required: true },
    comments: { type: Array, default: () => [] },
    members: { type: Array, default: () => [] },
  });
  const emit = defineEmits(["changed"]);

  const board = useBoard();
  const store = useStore();

  const draft = ref("");
  const assignTo = ref(null);
  const replyingTo = ref(null);
  const replyDraft = ref("");
  const editing = ref(null);
  const editDraft = ref("");

  // Matches the server's own rule in modules/board.js (COMMENT_WINDOW);
  // fetched so the two can never disagree about how long an edit is
  // allowed. Hiding the button once the window passes avoids a surprise
  // 409 on click — the server enforces the real rule regardless.
  const windows = ref({ member: 10, owner: 60 });
  onMounted(async () => {
    try {
      windows.value = await board.api.get("/boards/comment-window");
    } catch {
      // The defaults above are the same values the server ships with.
    }
  });

  // The handful people actually reach for. A full picker would be more
  // choice than anyone needs to say "seen" or "agreed".
  const QUICK_REACTIONS = ["👍", "✅", "🎉", "👀", "❤️", "😀"];

  const myWindowMinutes = () => (board.isOwner ? windows.value.owner : windows.value.member);

  function withinWindow(c) {
    return (Date.now() - new Date(c.created_at).getTime()) / 60000 <= myWindowMinutes();
  }

  /**
   * A board owner can remove any comment at any time (moderation);
   * otherwise Delete only appears for your own, and only within the
   * grace period.
   */
  function canDelete(c) {
    if (c.is_deleted) return false;
    const isOwn = c.staff_id === board.viewerId;
    if (board.isOwner && !isOwn) return true;
    if (!isOwn) return false;
    return withinWindow(c);
  }

  /** Editing is always own-comment-only, windowed the same way. */
  function canEdit(c) {
    if (c.is_deleted) return false;
    return c.staff_id === board.viewerId && withinWindow(c);
  }

  const fail = (err) => store.commit("setMessage", { type: "error", text: err.message });

  async function act(fn) {
    try {
      await fn();
      emit("changed");
    } catch (err) {
      fail(err);
    }
  }

  /** Resolves "@Name" against the board's people so mentions notify. */
  function mentionIdsIn(text) {
    return props.members.filter((m) => text.includes(`@${m.full_name}`)).map((m) => m.staff_id);
  }

  const escapeHtml = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /** Highlights resolved mentions so they read as references, not stray text. */
  function render(c) {
    let html = escapeHtml(c.body).replace(/\n/g, "<br>");
    for (const id of c.mention_ids || []) {
      const m = props.members.find((x) => x.staff_id === id);
      if (m) {
        html = html.replaceAll(`@${escapeHtml(m.full_name)}`, `<span class="mention">@${escapeHtml(m.full_name)}</span>`);
      }
    }
    return html;
  }

  async function post() {
    if (!draft.value.trim()) return;
    await act(async () => {
      await board.api.post(`/boards/cards/${props.cardId}/comments`, {
        body: draft.value.trim(),
        assigned_to: assignTo.value,
        mentionUserIds: mentionIdsIn(draft.value),
      });
      draft.value = "";
      assignTo.value = null;
    });
  }

  function startReply(c) {
    replyingTo.value = replyingTo.value === c.id ? null : c.id;
    replyDraft.value = "";
  }

  async function postReply(c) {
    if (!replyDraft.value.trim()) return;
    await act(async () => {
      await board.api.post(`/boards/cards/${props.cardId}/comments`, {
        body: replyDraft.value.trim(),
        parent_id: c.id,
        mentionUserIds: mentionIdsIn(replyDraft.value),
      });
      replyDraft.value = "";
      replyingTo.value = null;
    });
  }

  function startEdit(c) {
    editing.value = c.id;
    editDraft.value = c.body;
  }

  const saveEdit = (c) =>
    act(async () => {
      await board.api.put(`/boards/cards/${props.cardId}/comments/${c.id}`, {
        body: editDraft.value,
      });
      editing.value = null;
    });

  const remove = (c) => {
    if (!window.confirm("Delete this comment?")) return;
    act(() => board.api.del(`/boards/cards/${props.cardId}/comments/${c.id}`));
  };

  const toggleResolved = (c) =>
    act(() =>
      board.api.put(`/boards/cards/${props.cardId}/comments/${c.id}/resolve`, {
        resolved: !c.resolved_at,
      }),
    );

  const react = (c, emoji) =>
    act(() =>
      board.api.post(`/boards/cards/${props.cardId}/comments/${c.id}/reactions`, { emoji }),
    );

  const iReacted = (c, emoji) =>
    (c.reactions || []).find((r) => r.emoji === emoji)?.staff_ids?.includes(board.viewerId);
</script>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.comment-body {
  font-size: 0.875rem;
  line-height: 1.5;
  word-break: break-word;
}
.comment-body :deep(.mention) {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}
.comment-replies {
  margin-left: 46px;
  padding-left: 12px;
  border-left: 2px solid rgba(0, 0, 0, 0.08);
}
</style>
