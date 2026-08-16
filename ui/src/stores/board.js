import { computed, reactive } from "vue";
import { blankFilter } from "@/lib/boards";

/**
 * Holds one loaded board. Ported from ITSF-IMS's Pinia store — hbakery
 * uses Vuex, and registering a second global store just for boards would
 * be more ceremony than this needs, so it is a reactive singleton with
 * the same shape: `board.cards`, `board.filter`, `board.columns`, and so
 * on, used identically by every board component.
 *
 * The whole board arrives in one request, which is what lets filtering
 * and the alternate views run instantly with no round trip. Moves are
 * applied optimistically — a drag that waited for the server would feel
 * broken — and rolled back if the write fails.
 */

const state = reactive({
  board: null,
  loading: false,
  error: null,
  filter: blankFilter(),
  // Which lists this viewer has collapsed. A personal preference rather
  // than board state, so it lives in localStorage.
  collapsed: [],
  viewerId: null,
  // How the kanban is divided into columns. 'list' is the Trello
  // default; the others regroup the same cards without touching data.
  groupBy: "list",
  // Cards ticked for a bulk action. Cleared on every load, so a
  // selection can never outlive the cards it referred to.
  selected: [],
});

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || "Something went wrong");
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: "POST", body: body || {} }),
  put: (url, body) => request(url, { method: "PUT", body: body || {} }),
  del: (url) => request(url, { method: "DELETE" }),
};

const lists = computed(() =>
  [...(state.board?.lists || [])].sort((a, b) => a.position - b.position)
);
const labels = computed(() => state.board?.labels || []);
const members = computed(() => state.board?.members || []);
const statuses = computed(() => state.board?.statuses || []);
const customFields = computed(() => state.board?.custom_fields || []);
const canEdit = computed(() => ["OWNER", "MEMBER"].includes(state.board?.my_role));
const isOwner = computed(() => state.board?.my_role === "OWNER");

const statusById = computed(() =>
  Object.fromEntries((state.board?.statuses || []).map((s) => [s.id, s]))
);
const labelById = computed(() =>
  Object.fromEntries((state.board?.labels || []).map((l) => [l.id, l]))
);
const memberById = computed(() =>
  Object.fromEntries((state.board?.members || []).map((m) => [m.staff_id, m]))
);

const filterActive = computed(() => {
  const f = state.filter;
  return Boolean(
    f.labels.length || f.members.length || f.statuses.length ||
    f.priorities.length || f.due || f.watching || f.text.trim()
  );
});

/**
 * Every active filter must match. Deliberately AND rather than OR: a
 * person narrowing a busy board expects each choice to remove cards, not
 * add them.
 */
function matches(card) {
  const f = state.filter;
  if (f.labels.length && !f.labels.every((id) => (card.label_ids || []).includes(id))) return false;
  if (f.members.length && !f.members.every((id) => (card.member_ids || []).includes(id))) return false;
  // Status and priority are "any of", not "all of" — a card has only one
  // of each, so requiring every choice would always match nothing.
  if (f.statuses.length && !f.statuses.includes(card.status_id)) return false;
  if (f.priorities.length && !f.priorities.includes(card.priority)) return false;
  if (f.watching && !card.watching) return false;
  if (f.text.trim() && !card.title.toLowerCase().includes(f.text.trim().toLowerCase())) return false;
  if (f.due) {
    const at = card.due_at ? new Date(card.due_at) : null;
    const hours = at ? (at - new Date()) / 36e5 : null;
    if (f.due === "none" && at) return false;
    if (f.due === "complete" && !card.due_complete) return false;
    if (f.due === "overdue" && !(at && hours < 0 && !card.due_complete)) return false;
    if (f.due === "day" && !(at && hours >= 0 && hours <= 24)) return false;
    if (f.due === "week" && !(at && hours >= 0 && hours <= 168)) return false;
  }
  return true;
}

/** Cards in one list, filtered and already in position order. */
function cardsIn(listId) {
  return (state.board?.cards || [])
    .filter((c) => c.list_id === listId && matches(c))
    .sort((a, b) => a.position - b.position);
}

/**
 * The columns the board is divided into. Grouping by anything other than
 * list is a presentation choice — the cards and their lists are
 * untouched, which is why dragging is disabled in those modes.
 */
const columns = computed(() => {
  if (state.groupBy === "list") {
    return lists.value.map((l) => ({
      key: `list-${l.id}`, id: l.id, name: l.name, color: l.color, list: l,
    }));
  }
  if (state.groupBy === "assignee") {
    const memberIds = new Set(members.value.map((m) => m.staff_id));
    return [
      ...members.value.map((m) => ({
        key: `m-${m.staff_id}`, id: m.staff_id, name: m.full_name,
        match: (c) => (c.member_ids || []).includes(m.staff_id),
      })),
      // Catches cards assigned to nobody *and* cards assigned to someone
      // no longer on the board — otherwise those match no column at all
      // and silently vanish.
      {
        key: "m-none", id: null, name: "Unassigned",
        match: (c) => !(c.member_ids || []).some((id) => memberIds.has(id)),
      },
    ];
  }
  if (state.groupBy === "status") {
    const statusIds = new Set(statuses.value.map((s) => s.id));
    return [
      ...statuses.value.map((s) => ({
        key: `s-${s.id}`, id: s.id, name: s.name, color: s.color,
        match: (c) => c.status_id === s.id,
      })),
      {
        key: "s-none", id: null, name: "No status",
        match: (c) => !c.status_id || !statusIds.has(c.status_id),
      },
    ];
  }
  if (state.groupBy === "priority") {
    const order = ["URGENT", "HIGH", "NORMAL", "LOW"];
    return [
      ...order.map((p) => ({
        key: `p-${p}`, id: p, name: p[0] + p.slice(1).toLowerCase(),
        match: (c) => c.priority === p,
      })),
      { key: "p-none", id: null, name: "No priority", match: (c) => !c.priority },
    ];
  }
  // Grouped by when it falls due.
  const now = Date.now();
  const bucket = (c) => {
    if (!c.due_at) return "none";
    const diff = new Date(c.due_at) - now;
    if (diff < 0) return "overdue";
    if (diff <= 7 * 864e5) return "week";
    return "later";
  };
  return [
    { key: "d-overdue", id: "overdue", name: "Overdue", match: (c) => bucket(c) === "overdue" },
    { key: "d-week", id: "week", name: "This week", match: (c) => bucket(c) === "week" },
    { key: "d-later", id: "later", name: "Later", match: (c) => bucket(c) === "later" },
    { key: "d-none", id: "none", name: "No due date", match: (c) => bucket(c) === "none" },
  ];
});

function cardsInColumn(column) {
  const cards = (state.board?.cards || []).filter(matches);
  const inColumn = state.groupBy === "list"
    ? cards.filter((c) => c.list_id === column.id)
    : cards.filter(column.match);
  return inColumn.sort((a, b) => a.position - b.position);
}

/** Dragging only makes sense when columns are lists and nothing is hidden. */
const canReorder = computed(() => state.groupBy === "list" && !filterActive.value);

const totalIn = (listId) => (state.board?.cards || []).filter((c) => c.list_id === listId).length;

const isCollapsed = (key) => state.collapsed.includes(key);
const isSelected = (cardId) => state.selected.includes(cardId);
const selecting = computed(() => state.selected.length > 0);

// ── Actions ───────────────────────────────────────────────────────

function setViewer(id) {
  state.viewerId = id;
}

async function load(id) {
  state.loading = true;
  state.error = null;
  try {
    state.board = await api.get(`/boards/${id}`);
    loadCollapsed(id);
    state.groupBy = localStorage.getItem(`hb_board_group_${id}`) || "list";
    state.selected = [];
  } catch (err) {
    state.error = err;
    state.board = null;
  } finally {
    state.loading = false;
  }
}

/** Re-reads the board after a change too structural to patch in place. */
async function refresh() {
  if (!state.board) return;
  // Assigned rather than reloaded, so a refresh never clears this
  // viewer's filter or collapsed lists.
  state.board = await api.get(`/boards/${state.board.id}`);
}

function loadCollapsed(boardId) {
  try {
    state.collapsed = JSON.parse(localStorage.getItem(`hb_board_collapsed_${boardId}`)) || [];
  } catch {
    state.collapsed = [];
  }
}

function toggleCollapsed(key) {
  state.collapsed = state.collapsed.includes(key)
    ? state.collapsed.filter((k) => k !== key)
    : [...state.collapsed, key];
  localStorage.setItem(`hb_board_collapsed_${state.board.id}`, JSON.stringify(state.collapsed));
}

function toggleSelected(cardId) {
  state.selected = state.selected.includes(cardId)
    ? state.selected.filter((id) => id !== cardId)
    : [...state.selected, cardId];
}

function selectAllIn(column) {
  const ids = cardsInColumn(column).map((c) => c.id);
  const allChosen = ids.every((id) => state.selected.includes(id));
  state.selected = allChosen
    ? state.selected.filter((id) => !ids.includes(id))
    : [...new Set([...state.selected, ...ids])];
}

function clearSelection() {
  state.selected = [];
}

/** One change across every ticked card, then a reload to pick up the result. */
async function bulk(action, value = null) {
  const count = state.selected.length;
  await api.post("/boards/cards/bulk", { card_ids: state.selected, action, value });
  state.selected = [];
  await refresh();
  return count;
}

function setGroupBy(value) {
  state.groupBy = value;
  if (state.board) localStorage.setItem(`hb_board_group_${state.board.id}`, value);
}

/** Applies a saved view: its filter and its grouping. */
function applyView(view) {
  state.filter = { ...blankFilter(), ...(view.filters || {}) };
  state.groupBy = view.group_by || "list";
}

function patchCard(id, patch) {
  const card = state.board?.cards.find((c) => c.id === id);
  if (card) Object.assign(card, patch);
}

async function setListColor(listId, color) {
  const list = state.board.lists.find((l) => l.id === listId);
  const previous = list?.color;
  if (list) list.color = color;
  try {
    await api.put(`/boards/lists/${listId}`, { color });
  } catch (err) {
    if (list) list.color = previous;
    throw err;
  }
}

/**
 * Applies a drag locally, then persists it. The client sends the
 * neighbours the card was dropped between rather than a position, so it
 * never has to know how ordering is encoded and two simultaneous drags
 * cannot collide.
 */
async function moveCard(cardId, listId, index) {
  const card = state.board.cards.find((c) => c.id === cardId);
  if (!card) return;
  const before = { list_id: card.list_id, position: card.position };

  const siblings = cardsIn(listId).filter((c) => c.id !== cardId);
  const after = siblings[index - 1] || null;
  const nextOne = siblings[index] || null;

  // Optimistic: place it where it was dropped so the UI never flickers.
  card.list_id = listId;
  card.position = after && nextOne
    ? (after.position + nextOne.position) / 2
    : after ? after.position + 1000
    : nextOne ? nextOne.position - 1000
    : 1000;

  try {
    const saved = await api.put(`/boards/cards/${cardId}/move`, {
      list_id: listId,
      after_id: after?.id ?? null,
      before_id: nextOne?.id ?? null,
    });
    card.position = saved.position;
    card.list_id = saved.list_id;
  } catch (err) {
    Object.assign(card, before);
    throw err;
  }
}

async function addCard(listId, title) {
  const card = await api.post(`/boards/${state.board.id}/lists/${listId}/cards`, { title });
  state.board.cards.push(card);
  return card;
}

async function addList(name) {
  const list = await api.post(`/boards/${state.board.id}/lists`, { name });
  state.board.lists.push(list);
  return list;
}

async function renameList(listId, name) {
  const list = await api.put(`/boards/lists/${listId}`, { name });
  const found = state.board.lists.find((l) => l.id === listId);
  if (found) Object.assign(found, list);
}

async function archiveList(listId) {
  await api.del(`/boards/lists/${listId}`);
  state.board.lists = state.board.lists.filter((l) => l.id !== listId);
  state.board.cards = state.board.cards.filter((c) => c.list_id !== listId);
}

async function moveList(listId, index) {
  const others = lists.value.filter((l) => l.id !== listId);
  const after = others[index - 1] || null;
  const before = others[index] || null;
  const list = state.board.lists.find((l) => l.id === listId);
  const previous = list.position;

  list.position = after && before
    ? (after.position + before.position) / 2
    : after ? after.position + 1000
    : before ? before.position - 1000
    : 1000;

  try {
    const positions = await api.put(`/boards/lists/${listId}/move`, {
      after_id: after?.id ?? null,
      before_id: before?.id ?? null,
    });
    for (const p of positions) {
      const l = state.board.lists.find((x) => x.id === p.id);
      if (l) l.position = p.position;
    }
  } catch (err) {
    list.position = previous;
    throw err;
  }
}

async function moveStatus(statusId, index) {
  const others = statuses.value.filter((s) => s.id !== statusId);
  const after = others[index - 1] || null;
  const before = others[index] || null;
  const status = state.board.statuses.find((s) => s.id === statusId);
  const previous = status.position;

  status.position = after && before
    ? (after.position + before.position) / 2
    : after ? after.position + 1000
    : before ? before.position - 1000
    : 1000;

  try {
    const positions = await api.put(`/boards/statuses/${statusId}/move`, {
      after_id: after?.id ?? null,
      before_id: before?.id ?? null,
    });
    for (const p of positions) {
      const s = state.board.statuses.find((x) => x.id === p.id);
      if (s) s.position = p.position;
    }
    state.board.statuses.sort((a, b) => a.position - b.position);
  } catch (err) {
    status.position = previous;
    throw err;
  }
}

async function archiveCard(cardId) {
  await api.put(`/boards/cards/${cardId}/archive`, { archived: true });
  state.board.cards = state.board.cards.filter((c) => c.id !== cardId);
}

export function useBoard() {
  return {
    // state
    state,
    get board() { return state.board; },
    get loading() { return state.loading; },
    get error() { return state.error; },
    get filter() { return state.filter; },
    set filter(v) { state.filter = v; },
    get groupBy() { return state.groupBy; },
    get selected() { return state.selected; },
    get viewerId() { return state.viewerId; },

    // getters
    get lists() { return lists.value; },
    get labels() { return labels.value; },
    get members() { return members.value; },
    get statuses() { return statuses.value; },
    get customFields() { return customFields.value; },
    get canEdit() { return canEdit.value; },
    get isOwner() { return isOwner.value; },
    get statusById() { return statusById.value; },
    get labelById() { return labelById.value; },
    get memberById() { return memberById.value; },
    get filterActive() { return filterActive.value; },
    get columns() { return columns.value; },
    get canReorder() { return canReorder.value; },
    get selecting() { return selecting.value; },

    matches,
    cardsIn,
    cardsInColumn,
    totalIn,
    isCollapsed,
    isSelected,

    // actions
    api,
    setViewer,
    load,
    refresh,
    toggleCollapsed,
    toggleSelected,
    selectAllIn,
    clearSelection,
    bulk,
    setGroupBy,
    applyView,
    patchCard,
    setListColor,
    moveCard,
    addCard,
    addList,
    renameList,
    archiveList,
    moveList,
    moveStatus,
    archiveCard,
  };
}
