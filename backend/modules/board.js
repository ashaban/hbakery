// modules/board.js
//
// Boards, lists, cards and everything hung off a card. Adapted from
// ITSF-IMS's board service — see migrations/018_boards.sql for the three
// deliberate simplifications (visibility, link-based attachments, no
// notifications) and why.
//
// Access rules and the drag/drop ordering scheme live here so routes/
// board.js stays thin, matching how modules/payroll.js and modules/
// loan.js are organised.

class BoardError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code || "BOARD_ERROR";
  }
}

// ── Ordering ──────────────────────────────────────────────────────

const STEP = 1000;
// Below this the midpoints are close enough to double-precision's limits
// that a further split would start losing precision, so the list is
// renumbered instead.
const MIN_GAP = 0.0001;

/** The position for an item dropped between two neighbours. */
function positionBetween(prev, next) {
  if (prev == null && next == null) return STEP;
  if (prev == null) return next - STEP;
  if (next == null) return prev + STEP;
  return (prev + next) / 2;
}

/** True once neighbours are too close together to split further. */
function needsRebalance(prev, next) {
  return prev != null && next != null && Math.abs(next - prev) < MIN_GAP;
}

/** Renumbers a scoped list back to 1000, 2000, 3000… */
async function rebalance(client, table, scopeColumn, scopeId) {
  const { rows } = await client.query(
    `SELECT id FROM ${table} WHERE ${scopeColumn} = $1 ORDER BY "position", id`,
    [scopeId]
  );
  for (const [i, row] of rows.entries()) {
    await client.query(`UPDATE ${table} SET "position" = $2 WHERE id = $1`, [
      row.id,
      (i + 1) * STEP,
    ]);
  }
}

const DEFAULT_STATUSES = [
  { name: "To do", color: "#78909C", category: "TODO" },
  { name: "In progress", color: "#0277BD", category: "IN_PROGRESS" },
  { name: "Done", color: "#2E7D32", category: "DONE" },
];

const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"];

// ── Access ────────────────────────────────────────────────────────

/**
 * A user's role on a board: explicit membership first, then the
 * can_manage_all_boards override (never on a board they'd otherwise have
 * no access to at all — that's what "all" means), then visibility=ALL.
 * Returns { board, role } with role null if they have no access.
 */
async function boardRole(client, user, boardId) {
  const { rows } = await client.query(`SELECT * FROM board WHERE id = $1`, [boardId]);
  const board = rows[0];
  if (!board) throw new BoardError("Board not found", "NOT_FOUND");

  const { rows: member } = await client.query(
    `SELECT role FROM board_member WHERE board_id = $1 AND user_id = $2`,
    [boardId, user.id]
  );
  if (member[0]) return { board, role: member[0].role, explicit: true };

  const tasks = user.tasks || [];
  if (tasks.includes("can_manage_all_boards")) {
    return { board, role: "OWNER", explicit: false };
  }
  if (board.visibility === "ALL") return { board, role: "MEMBER", explicit: false };
  return { board, role: null, explicit: false };
}

async function assertBoardAccess(client, user, boardId) {
  const found = await boardRole(client, user, boardId);
  if (!found.role) throw new BoardError("You do not have access to this board", "FORBIDDEN");
  return found;
}

/** OBSERVER may read but never write. */
async function assertBoardEdit(client, user, boardId) {
  const found = await assertBoardAccess(client, user, boardId);
  if (found.role === "OBSERVER") {
    throw new BoardError("You have read-only access to this board", "FORBIDDEN");
  }
  return found;
}

/** Renaming, archiving, membership and structure are the owner's alone. */
async function assertBoardOwner(client, user, boardId) {
  const found = await assertBoardAccess(client, user, boardId);
  if (found.role !== "OWNER") {
    throw new BoardError("Only a board owner can do that", "FORBIDDEN");
  }
  return found;
}

/** Resolves a card to its board, then applies the board's access rules. */
async function cardBoard(client, user, cardId, { edit = false } = {}) {
  const { rows } = await client.query(`SELECT * FROM board_card WHERE id = $1`, [cardId]);
  const card = rows[0];
  if (!card) throw new BoardError("Card not found", "NOT_FOUND");
  const found = edit
    ? await assertBoardEdit(client, user, card.board_id)
    : await assertBoardAccess(client, user, card.board_id);
  return { card, ...found };
}

// ── Boards ────────────────────────────────────────────────────────

/** Boards a user can see: explicit membership, plus every ALL board. */
async function listBoards(client, user) {
  const tasks = user.tasks || [];
  const seeAll = tasks.includes("can_manage_all_boards");

  const { rows } = await client.query(
    `SELECT b.*, m.role AS my_role,
            (SELECT COUNT(*) FROM board_card c
              WHERE c.board_id = b.id AND NOT c.is_archived) AS card_count,
            (SELECT COUNT(*) FROM board_member bm WHERE bm.board_id = b.id) AS member_count
     FROM board b
     LEFT JOIN board_member m ON m.board_id = b.id AND m.user_id = $1
     WHERE NOT b.is_archived AND NOT b.is_template
       AND (m.user_id IS NOT NULL OR b.visibility = 'ALL' OR $2)
     ORDER BY b.updated_at DESC`,
    [user.id, seeAll]
  );
  return rows;
}

async function createBoard(client, user, { name, description, visibility }) {
  if (!name?.trim()) throw new BoardError("A board name is required", "INVALID");

  const { rows } = await client.query(
    `INSERT INTO board (name, description, visibility, created_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [name.trim(), description || null, visibility === "ALL" ? "ALL" : "PRIVATE", user.id]
  );
  const board = rows[0];

  await client.query(
    `INSERT INTO board_member (board_id, user_id, role) VALUES ($1,$2,'OWNER')`,
    [board.id, user.id]
  );

  for (const [i, status] of DEFAULT_STATUSES.entries()) {
    await client.query(
      `INSERT INTO board_status (board_id, name, color, category, "position")
       VALUES ($1,$2,$3,$4,$5)`,
      [board.id, status.name, status.color, status.category, (i + 1) * STEP]
    );
  }

  const defaultList = await client.query(
    `INSERT INTO board_list (board_id, name, "position") VALUES ($1,'To do',$2) RETURNING *`,
    [board.id, STEP]
  );

  return { ...board, defaultListId: defaultList.rows[0].id };
}

async function getBoard(client, user, boardId) {
  const { board, role } = await assertBoardAccess(client, user, boardId);

  const [{ rows: lists }, { rows: labels }, { rows: statuses }, { rows: customFields }, { rows: members }] =
    await Promise.all([
      client.query(
        `SELECT * FROM board_list WHERE board_id = $1 AND NOT is_archived ORDER BY "position"`,
        [boardId]
      ),
      client.query(`SELECT * FROM board_label WHERE board_id = $1 ORDER BY id`, [boardId]),
      client.query(`SELECT * FROM board_status WHERE board_id = $1 ORDER BY "position"`, [boardId]),
      client.query(
        `SELECT * FROM board_custom_field WHERE board_id = $1 ORDER BY "position"`,
        [boardId]
      ),
      client.query(
        `SELECT bm.user_id, bm.role, u.name AS user_name
         FROM board_member bm JOIN users u ON u.id = bm.user_id
         WHERE bm.board_id = $1 ORDER BY u.name`,
        [boardId]
      ),
    ]);

  return { ...board, my_role: role, lists, labels, statuses, custom_fields: customFields, members };
}

async function updateBoard(client, user, boardId, patch) {
  await assertBoardOwner(client, user, boardId);
  const { name, description, visibility, is_archived } = patch;
  const { rows } = await client.query(
    `UPDATE board SET
       name = COALESCE($2, name), description = COALESCE($3, description),
       visibility = COALESCE($4, visibility), is_archived = COALESCE($5, is_archived),
       updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [boardId, name?.trim(), description, visibility, is_archived]
  );
  return rows[0];
}

async function addBoardMember(client, user, boardId, { user_id: userId, role }) {
  await assertBoardOwner(client, user, boardId);
  const { rows } = await client.query(
    `INSERT INTO board_member (board_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [boardId, userId, ["OWNER", "MEMBER", "OBSERVER"].includes(role) ? role : "MEMBER"]
  );
  return rows[0];
}

async function removeBoardMember(client, user, boardId, staffId) {
  const { role: ownRole } = await assertBoardAccess(client, user, boardId);
  // A member may remove themselves even without owner rights (leaving a
  // board they were added to); removing someone else needs ownership.
  if (Number(staffId) !== user.id && ownRole !== "OWNER") {
    throw new BoardError("Only a board owner can remove another member", "FORBIDDEN");
  }
  const { rows: owners } = await client.query(
    `SELECT COUNT(*)::int AS n FROM board_member WHERE board_id = $1 AND role = 'OWNER'`,
    [boardId]
  );
  const { rows: target } = await client.query(
    `SELECT role FROM board_member WHERE board_id = $1 AND user_id = $2`,
    [boardId, staffId]
  );
  if (target[0]?.role === "OWNER" && owners[0].n <= 1) {
    throw new BoardError("A board must keep at least one owner", "LAST_OWNER");
  }
  await client.query(`DELETE FROM board_member WHERE board_id = $1 AND user_id = $2`, [
    boardId,
    staffId,
  ]);
}

// ── Lists ─────────────────────────────────────────────────────────

async function createList(client, user, boardId, { name, color }) {
  await assertBoardEdit(client, user, boardId);
  if (!name?.trim()) throw new BoardError("A list name is required", "INVALID");

  const { rows: last } = await client.query(
    `SELECT "position" FROM board_list WHERE board_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [boardId]
  );
  const position = positionBetween(last[0]?.position ?? null, null);

  const { rows } = await client.query(
    `INSERT INTO board_list (board_id, name, color, "position") VALUES ($1,$2,$3,$4) RETURNING *`,
    [boardId, name.trim(), color || null, position]
  );
  return rows[0];
}

async function moveList(client, user, listId, { before_id, after_id }) {
  const { rows } = await client.query(`SELECT * FROM board_list WHERE id = $1`, [listId]);
  const list = rows[0];
  if (!list) throw new BoardError("List not found", "NOT_FOUND");
  await assertBoardEdit(client, user, list.board_id);

  const neighbour = async (id) => {
    if (!id) return null;
    const { rows: n } = await client.query(`SELECT "position" FROM board_list WHERE id = $1`, [id]);
    return n[0]?.position ?? null;
  };
  const prev = await neighbour(before_id);
  const next = await neighbour(after_id);
  const position = positionBetween(prev, next);

  await client.query(`UPDATE board_list SET "position" = $2 WHERE id = $1`, [listId, position]);
  if (needsRebalance(prev, next)) await rebalance(client, "board_list", "board_id", list.board_id);
}

async function archiveList(client, user, listId) {
  const { rows } = await client.query(`SELECT * FROM board_list WHERE id = $1`, [listId]);
  const list = rows[0];
  if (!list) throw new BoardError("List not found", "NOT_FOUND");
  await assertBoardEdit(client, user, list.board_id);
  await client.query(`UPDATE board_list SET is_archived = true WHERE id = $1`, [listId]);
}

// ── Cards ─────────────────────────────────────────────────────────

const CARD_SELECT = `
  SELECT c.*,
         (SELECT COALESCE(json_agg(json_build_object('user_id', cm.user_id, 'name', u.name)), '[]')
            FROM card_member cm JOIN users u ON u.id = cm.user_id WHERE cm.card_id = c.id) AS members,
         (SELECT COALESCE(json_agg(json_build_object('id', bl.id, 'name', bl.name, 'color', bl.color)), '[]')
            FROM card_label cl JOIN board_label bl ON bl.id = cl.label_id WHERE cl.card_id = c.id) AS labels,
         (SELECT COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color)), '[]')
            FROM card_tag ct JOIN tag t ON t.id = ct.tag_id WHERE ct.card_id = c.id) AS tags,
         (SELECT COUNT(*)::int FROM card_checklist_item i
            JOIN card_checklist cl2 ON cl2.id = i.checklist_id WHERE cl2.card_id = c.id) AS checklist_total,
         (SELECT COUNT(*)::int FROM card_checklist_item i
            JOIN card_checklist cl2 ON cl2.id = i.checklist_id
            WHERE cl2.card_id = c.id AND i.is_done) AS checklist_done,
         (SELECT COUNT(*)::int FROM card_comment WHERE card_id = c.id) AS comment_count,
         (SELECT COUNT(*)::int FROM card_link WHERE card_id = c.id) AS link_count,
         (SELECT COUNT(*)::int FROM board_card sub WHERE sub.parent_card_id = c.id AND NOT sub.is_archived) AS subtask_count,
         (SELECT COALESCE(SUM(minutes), 0)::int FROM card_time_entry WHERE card_id = c.id) AS logged_minutes
  FROM board_card c
`;

/** Every non-archived card on a board, for the kanban/table/calendar/Gantt/workload views. */
async function listCards(client, user, boardId, { includeArchived = false } = {}) {
  await assertBoardAccess(client, user, boardId);
  await spawnDueRecurrences(client, boardId);

  const { rows } = await client.query(
    `${CARD_SELECT} WHERE c.board_id = $1 ${includeArchived ? "" : "AND NOT c.is_archived"}
     ORDER BY c.list_id, c."position"`,
    [boardId]
  );
  return rows;
}

async function createCard(client, user, boardId, { list_id, title, description, status_id }) {
  await assertBoardEdit(client, user, boardId);
  if (!title?.trim()) throw new BoardError("A card title is required", "INVALID");

  const { rows: listRow } = await client.query(
    `SELECT id FROM board_list WHERE id = $1 AND board_id = $2`,
    [list_id, boardId]
  );
  if (!listRow[0]) throw new BoardError("That list is not on this board", "INVALID");

  let statusId = status_id || null;
  if (!statusId) {
    const { rows: firstStatus } = await client.query(
      `SELECT id FROM board_status WHERE board_id = $1 ORDER BY "position" LIMIT 1`,
      [boardId]
    );
    statusId = firstStatus[0]?.id || null;
  }

  const { rows: last } = await client.query(
    `SELECT "position" FROM board_card WHERE list_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [list_id]
  );
  const position = positionBetween(last[0]?.position ?? null, null);

  const { rows } = await client.query(
    `INSERT INTO board_card (board_id, list_id, status_id, title, description, "position", created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [boardId, list_id, statusId, title.trim(), description || null, position, user.id]
  );
  const cardId = rows[0].id;

  await logActivity(client, { cardId, boardId, staffId: user.id, action: "CREATED", summary: `${user.name} created this card` });

  return getCard(client, user, cardId);
}

async function getCard(client, user, cardId) {
  const { card } = await cardBoard(client, user, cardId);
  const { rows } = await client.query(`${CARD_SELECT} WHERE c.id = $1`, [cardId]);
  const full = rows[0];

  const [
    { rows: checklists },
    { rows: items },
    { rows: comments },
    { rows: mentions },
    { rows: links },
    { rows: customValues },
    { rows: dependencies },
    { rows: subtasks },
    { rows: activity },
    { rows: timeEntries },
    { rows: recurrence },
  ] = await Promise.all([
    client.query(`SELECT * FROM card_checklist WHERE card_id = $1 ORDER BY "position"`, [cardId]),
    client.query(
      `SELECT i.* FROM card_checklist_item i
       JOIN card_checklist cl ON cl.id = i.checklist_id
       WHERE cl.card_id = $1 ORDER BY i."position"`,
      [cardId]
    ),
    client.query(
      `SELECT cm.*, u.name AS staff_name
       FROM card_comment cm JOIN users u ON u.id = cm.user_id
       WHERE cm.card_id = $1 ORDER BY cm.created_at`,
      [cardId]
    ),
    client.query(
      `SELECT cmm.comment_id, cmm.user_id, u.name FROM card_comment_mention cmm
       JOIN users u ON u.id = cmm.user_id
       JOIN card_comment cc ON cc.id = cmm.comment_id WHERE cc.card_id = $1`,
      [cardId]
    ),
    client.query(`SELECT * FROM card_link WHERE card_id = $1 ORDER BY added_at DESC`, [cardId]),
    client.query(`SELECT field_id, value FROM card_custom_value WHERE card_id = $1`, [cardId]),
    client.query(
      `SELECT d.blocker_card_id, bc.title AS blocker_title, bc.is_archived AS blocker_done,
              (SELECT bs.category FROM board_status bs WHERE bs.id = bc.status_id) AS blocker_status
       FROM card_dependency d JOIN board_card bc ON bc.id = d.blocker_card_id
       WHERE d.blocked_card_id = $1`,
      [cardId]
    ),
    client.query(
      `SELECT id, title, is_archived, status_id FROM board_card WHERE parent_card_id = $1 ORDER BY id`,
      [cardId]
    ),
    client.query(
      `SELECT a.*, u.name AS staff_name FROM card_activity a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.card_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
      [cardId]
    ),
    client.query(
      `SELECT t.*, u.name AS staff_name FROM card_time_entry t
       JOIN users u ON u.id = t.user_id WHERE t.card_id = $1 ORDER BY t.started_at DESC`,
      [cardId]
    ),
    client.query(`SELECT * FROM card_recurrence WHERE card_id = $1`, [cardId]),
  ]);

  return {
    ...full,
    checklists: checklists.map((cl) => ({
      ...cl,
      items: items.filter((i) => i.checklist_id === cl.id),
    })),
    comments: comments.map((c) => ({
      ...c,
      mentions: mentions.filter((m) => m.comment_id === c.id),
    })),
    links,
    custom_values: customValues,
    blocked_by: dependencies,
    subtasks,
    activity,
    time_entries: timeEntries,
    recurrence: recurrence[0] || null,
  };
}

async function updateCard(client, user, cardId, patch) {
  await cardBoard(client, user, cardId, { edit: true });
  const allowed = [
    "title", "description", "status_id", "priority", "is_milestone",
    "start_at", "due_at", "due_complete", "estimate_minutes", "cover_color",
  ];
  const sets = [];
  const params = [cardId];
  for (const key of allowed) {
    if (!(key in patch)) continue;
    params.push(patch[key]);
    sets.push(`${key} = $${params.length}`);
  }
  if (!sets.length) return getCard(client, user, cardId);

  await client.query(
    `UPDATE board_card SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1`,
    params
  );
  return getCard(client, user, cardId);
}

/** Moves a card to a (possibly different) list at a new position. */
async function moveCard(client, user, cardId, { list_id, before_id, after_id }) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });

  let listId = card.list_id;
  if (list_id && list_id !== card.list_id) {
    const { rows: listRow } = await client.query(
      `SELECT id FROM board_list WHERE id = $1 AND board_id = $2`,
      [list_id, card.board_id]
    );
    if (!listRow[0]) throw new BoardError("That list is not on this board", "INVALID");
    listId = list_id;
  }

  const neighbour = async (id) => {
    if (!id) return null;
    const { rows: n } = await client.query(`SELECT "position" FROM board_card WHERE id = $1`, [id]);
    return n[0]?.position ?? null;
  };
  const prev = await neighbour(before_id);
  const next = await neighbour(after_id);
  const position = positionBetween(prev, next);

  await client.query(`UPDATE board_card SET list_id = $2, "position" = $3, updated_at = NOW() WHERE id = $1`, [
    cardId,
    listId,
    position,
  ]);
  if (needsRebalance(prev, next)) await rebalance(client, "board_card", "list_id", listId);

  if (listId !== card.list_id) {
    const { rows: listName } = await client.query(`SELECT name FROM board_list WHERE id = $1`, [listId]);
    await logActivity(client, {
      cardId, boardId: card.board_id, staffId: user.id, action: "MOVED",
      summary: `${user.name} moved this card to "${listName[0]?.name}"`,
    });
  }

  return getCard(client, user, cardId);
}

async function archiveCard(client, user, cardId, archived = true) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  await client.query(`UPDATE board_card SET is_archived = $2, updated_at = NOW() WHERE id = $1`, [
    cardId,
    archived,
  ]);
  await logActivity(client, {
    cardId, boardId: card.board_id, staffId: user.id,
    action: archived ? "ARCHIVED" : "RESTORED",
    summary: `${user.name} ${archived ? "archived" : "restored"} this card`,
  });
}

async function deleteCard(client, user, cardId) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM board_card WHERE id = $1`, [cardId]);
  return card;
}

// ── Members, labels, tags on a card ─────────────────────────────────

async function setCardMembers(client, user, cardId, staffIds) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_member WHERE card_id = $1`, [cardId]);
  for (const staffId of staffIds) {
    await client.query(`INSERT INTO card_member (card_id, user_id) VALUES ($1,$2)`, [cardId, staffId]);
  }
  if (staffIds.length) {
    const { rows: names } = await client.query(
      `SELECT name FROM users WHERE id = ANY($1::int[])`,
      [staffIds]
    );
    await logActivity(client, {
      cardId, boardId: card.board_id, staffId: user.id, action: "ASSIGNED",
      summary: `${user.name} assigned this card to ${names.map((n) => n.name).join(", ")}`,
    });
  }
}

async function setCardLabels(client, user, cardId, labelIds) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_label WHERE card_id = $1`, [cardId]);
  for (const labelId of labelIds) {
    await client.query(`INSERT INTO card_label (card_id, label_id) VALUES ($1,$2)`, [cardId, labelId]);
  }
}

async function setCardTags(client, user, cardId, tagNames) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_tag WHERE card_id = $1`, [cardId]);
  for (const raw of tagNames) {
    const name = raw.trim();
    if (!name) continue;
    const { rows } = await client.query(
      `INSERT INTO tag (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name]
    );
    await client.query(`INSERT INTO card_tag (card_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [
      cardId,
      rows[0].id,
    ]);
  }
}

// ── Checklists ────────────────────────────────────────────────────

async function addChecklist(client, user, cardId, name) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  const { rows: last } = await client.query(
    `SELECT "position" FROM card_checklist WHERE card_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [cardId]
  );
  const position = positionBetween(last[0]?.position ?? null, null);
  const { rows } = await client.query(
    `INSERT INTO card_checklist (card_id, name, "position") VALUES ($1,$2,$3) RETURNING *`,
    [cardId, name?.trim() || "Checklist", position]
  );
  void card;
  return rows[0];
}

async function addChecklistItem(client, user, checklistId, { content, assignee_id, due_at }) {
  const { rows: cl } = await client.query(`SELECT * FROM card_checklist WHERE id = $1`, [checklistId]);
  if (!cl[0]) throw new BoardError("Checklist not found", "NOT_FOUND");
  await cardBoard(client, user, cl[0].card_id, { edit: true });

  const { rows: last } = await client.query(
    `SELECT "position" FROM card_checklist_item WHERE checklist_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [checklistId]
  );
  const position = positionBetween(last[0]?.position ?? null, null);

  const { rows } = await client.query(
    `INSERT INTO card_checklist_item (checklist_id, content, assignee_id, due_at, "position")
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [checklistId, content.trim(), assignee_id || null, due_at || null, position]
  );
  return rows[0];
}

async function toggleChecklistItem(client, user, itemId, done) {
  const { rows: item } = await client.query(
    `SELECT i.*, cl.card_id FROM card_checklist_item i
     JOIN card_checklist cl ON cl.id = i.checklist_id WHERE i.id = $1`,
    [itemId]
  );
  if (!item[0]) throw new BoardError("Checklist item not found", "NOT_FOUND");
  await cardBoard(client, user, item[0].card_id, { edit: true });

  await client.query(
    `UPDATE card_checklist_item
     SET is_done = $2, done_by = CASE WHEN $2 THEN $3::integer ELSE NULL END,
         done_at = CASE WHEN $2 THEN NOW() ELSE NULL END
     WHERE id = $1`,
    [itemId, done, user.id]
  );
}

async function deleteChecklistItem(client, user, itemId) {
  const { rows: item } = await client.query(
    `SELECT i.*, cl.card_id FROM card_checklist_item i
     JOIN card_checklist cl ON cl.id = i.checklist_id WHERE i.id = $1`,
    [itemId]
  );
  if (!item[0]) return;
  await cardBoard(client, user, item[0].card_id, { edit: true });
  await client.query(`DELETE FROM card_checklist_item WHERE id = $1`, [itemId]);
}

// ── Comments ──────────────────────────────────────────────────────

/** `mentionNames` — staff names typed as "@Name" in the comment body, resolved here. */
async function addComment(client, user, cardId, { body, assigned_to, mentionStaffIds = [] }) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  if (!body?.trim()) throw new BoardError("A comment body is required", "INVALID");

  const { rows } = await client.query(
    `INSERT INTO card_comment (card_id, user_id, body, assigned_to) VALUES ($1,$2,$3,$4) RETURNING *`,
    [cardId, user.id, body.trim(), assigned_to || null]
  );
  const comment = rows[0];

  for (const staffId of mentionStaffIds) {
    await client.query(
      `INSERT INTO card_comment_mention (comment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [comment.id, staffId]
    );
  }

  await logActivity(client, {
    cardId, boardId: card.board_id, staffId: user.id, action: "COMMENTED",
    summary: `${user.name} commented`,
  });

  return comment;
}

async function resolveComment(client, user, commentId) {
  const { rows } = await client.query(`SELECT * FROM card_comment WHERE id = $1`, [commentId]);
  if (!rows[0]) throw new BoardError("Comment not found", "NOT_FOUND");
  await cardBoard(client, user, rows[0].card_id, { edit: true });
  await client.query(
    `UPDATE card_comment SET resolved_at = NOW(), resolved_by = $2, updated_at = NOW() WHERE id = $1`,
    [commentId, user.id]
  );
}

// ── Links (attachment stand-in) ──────────────────────────────────────

async function addLink(client, user, cardId, { url, label }) {
  await cardBoard(client, user, cardId, { edit: true });
  if (!url?.trim()) throw new BoardError("A URL is required", "INVALID");
  const { rows } = await client.query(
    `INSERT INTO card_link (card_id, url, label, added_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [cardId, url.trim(), label?.trim() || null, user.id]
  );
  return rows[0];
}

async function deleteLink(client, user, linkId) {
  const { rows } = await client.query(`SELECT * FROM card_link WHERE id = $1`, [linkId]);
  if (!rows[0]) return;
  await cardBoard(client, user, rows[0].card_id, { edit: true });
  await client.query(`DELETE FROM card_link WHERE id = $1`, [linkId]);
}

// ── Dependencies ──────────────────────────────────────────────────

/** BFS from `blockedId` following existing "is blocked by" edges — if it
 * reaches `blockerId`, adding this edge would close a cycle. */
async function wouldCreateCycle(client, blockerId, blockedId) {
  if (blockerId === blockedId) return true;
  const seen = new Set([blockedId]);
  let frontier = [blockedId];
  while (frontier.length) {
    const { rows } = await client.query(
      `SELECT blocked_card_id FROM card_dependency WHERE blocker_card_id = ANY($1::int[])`,
      [frontier]
    );
    frontier = [];
    for (const row of rows) {
      if (row.blocked_card_id === blockerId) return true;
      if (!seen.has(row.blocked_card_id)) {
        seen.add(row.blocked_card_id);
        frontier.push(row.blocked_card_id);
      }
    }
  }
  return false;
}

async function addDependency(client, user, blockedCardId, blockerCardId) {
  // blockedCardId arrives as a route :param (always a string); blockerCardId
  // arrives from the JSON body (already a number). Left uncoerced, the
  // self-block and cycle checks below compare a string to a number, which
  // is never === in JS regardless of value — silently skipping both checks
  // and letting a bad request reach the database's own constraint instead
  // of this function's proper error message.
  blockedCardId = Number(blockedCardId);
  blockerCardId = Number(blockerCardId);
  if (!blockerCardId) throw new BoardError("A blocking card is required", "INVALID");

  const { card } = await cardBoard(client, user, blockedCardId, { edit: true });
  const { rows: blocker } = await client.query(`SELECT board_id FROM board_card WHERE id = $1`, [
    blockerCardId,
  ]);
  if (!blocker[0]) throw new BoardError("Blocking card not found", "NOT_FOUND");
  if (blocker[0].board_id !== card.board_id) {
    throw new BoardError("A card can only be blocked by a card on the same board", "INVALID");
  }
  if (await wouldCreateCycle(client, blockerCardId, blockedCardId)) {
    throw new BoardError("That would create a circular dependency", "CYCLE");
  }
  await client.query(
    `INSERT INTO card_dependency (blocker_card_id, blocked_card_id, created_by)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [blockerCardId, blockedCardId, user.id]
  );
}

async function removeDependency(client, user, blockedCardId, blockerCardId) {
  await cardBoard(client, user, blockedCardId, { edit: true });
  await client.query(
    `DELETE FROM card_dependency WHERE blocker_card_id = $1 AND blocked_card_id = $2`,
    [blockerCardId, blockedCardId]
  );
}

// ── Subtasks ──────────────────────────────────────────────────────

async function addSubtask(client, user, parentCardId, title) {
  const { card: parent } = await cardBoard(client, user, parentCardId, { edit: true });
  if (parent.parent_card_id) {
    throw new BoardError("Subtasks can't be nested more than one level deep", "TOO_DEEP");
  }
  const child = await createCard(client, user, parent.board_id, {
    list_id: parent.list_id,
    title,
  });
  await client.query(`UPDATE board_card SET parent_card_id = $2 WHERE id = $1`, [
    child.id,
    parentCardId,
  ]);
  return getCard(client, user, child.id);
}

// ── Time tracking ─────────────────────────────────────────────────

async function startTimer(client, user, cardId) {
  await cardBoard(client, user, cardId, { edit: true });
  const { rows: running } = await client.query(
    `SELECT id FROM card_time_entry WHERE user_id = $1 AND ended_at IS NULL`,
    [user.id]
  );
  if (running[0]) {
    throw new BoardError("You already have a timer running on another card", "TIMER_RUNNING");
  }
  const { rows } = await client.query(
    `INSERT INTO card_time_entry (card_id, user_id) VALUES ($1,$2) RETURNING *`,
    [cardId, user.id]
  );
  return rows[0];
}

async function stopTimer(client, user, entryId) {
  const { rows } = await client.query(`SELECT * FROM card_time_entry WHERE id = $1`, [entryId]);
  const entry = rows[0];
  if (!entry) throw new BoardError("Time entry not found", "NOT_FOUND");
  if (entry.user_id !== user.id) throw new BoardError("That isn't your timer", "FORBIDDEN");
  const minutes = Math.max(1, Math.round((Date.now() - new Date(entry.started_at).getTime()) / 60000));
  const { rows: updated } = await client.query(
    `UPDATE card_time_entry SET ended_at = NOW(), minutes = $2 WHERE id = $1 RETURNING *`,
    [entryId, minutes]
  );
  return updated[0];
}

async function addManualTimeEntry(client, user, cardId, { minutes, note, started_at }) {
  await cardBoard(client, user, cardId, { edit: true });
  if (!(Number(minutes) > 0)) throw new BoardError("Minutes must be greater than zero", "INVALID");
  const { rows } = await client.query(
    `INSERT INTO card_time_entry (card_id, user_id, started_at, ended_at, minutes, note)
     VALUES ($1,$2,COALESCE($3,NOW()),NOW(),$4,$5) RETURNING *`,
    [cardId, user.id, started_at || null, minutes, note || null]
  );
  return rows[0];
}

// ── Recurrence ────────────────────────────────────────────────────

function nextRunAfter(from, rule) {
  const d = new Date(from);
  const step = rule.interval || 1;
  if (rule.freq === "DAILY") d.setDate(d.getDate() + step);
  else if (rule.freq === "WEEKLY") d.setDate(d.getDate() + 7 * step);
  else if (rule.freq === "MONTHLY") d.setMonth(d.getMonth() + step);
  else if (rule.freq === "QUARTERLY") d.setMonth(d.getMonth() + 3 * step);
  else if (rule.freq === "YEARLY") d.setFullYear(d.getFullYear() + step);
  return d;
}

async function setRecurrence(client, user, cardId, rule) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  if (card.parent_card_id) {
    throw new BoardError("Only a top-level card can recur", "INVALID");
  }
  const nextRun = nextRunAfter(new Date(), rule);
  const { rows } = await client.query(
    `INSERT INTO card_recurrence (card_id, freq, "interval", weekdays, day_of_month, next_run_at, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (card_id) DO UPDATE SET
       freq = EXCLUDED.freq, "interval" = EXCLUDED.interval, weekdays = EXCLUDED.weekdays,
       day_of_month = EXCLUDED.day_of_month, next_run_at = EXCLUDED.next_run_at, ends_at = EXCLUDED.ends_at
     RETURNING *`,
    [cardId, rule.freq, rule.interval || 1, rule.weekdays || null, rule.day_of_month || null, nextRun, rule.ends_at || null, user.id]
  );
  return rows[0];
}

async function clearRecurrence(client, user, cardId) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_recurrence WHERE card_id = $1`, [cardId]);
}

/**
 * Checked on demand (whenever a board's cards are listed) rather than by
 * a cron sweeper — hbakery's server has no job scheduler, and for a
 * low-traffic internal tool "due the next time someone opens the board"
 * is close enough to "due on the day" to not need one. Spawns at most
 * one card per overdue recurrence per call, then advances next_run_at,
 * so a board left unopened for months doesn't dump a backlog on return.
 */
async function spawnDueRecurrences(client, boardId) {
  const { rows: due } = await client.query(
    `SELECT r.*, c.title, c.list_id, c.description, c.board_id
     FROM card_recurrence r JOIN board_card c ON c.id = r.card_id
     WHERE c.board_id = $1 AND r.next_run_at <= NOW()
       AND (r.ends_at IS NULL OR r.next_run_at <= r.ends_at)`,
    [boardId]
  );

  for (const rule of due) {
    const { rows: last } = await client.query(
      `SELECT "position" FROM board_card WHERE list_id = $1 ORDER BY "position" DESC LIMIT 1`,
      [rule.list_id]
    );
    const position = positionBetween(last[0]?.position ?? null, null);

    const { rows: firstStatus } = await client.query(
      `SELECT id FROM board_status WHERE board_id = $1 ORDER BY "position" LIMIT 1`,
      [rule.board_id]
    );

    const { rows: spawned } = await client.query(
      `INSERT INTO board_card (board_id, list_id, status_id, title, description, "position", created_by)
       VALUES ($1,$2,$3,$4,$5,$6,NULL) RETURNING id`,
      [rule.board_id, rule.list_id, firstStatus[0]?.id || null, rule.title, rule.description, position]
    );

    const nextRun = nextRunAfter(rule.next_run_at, rule);
    await client.query(
      `UPDATE card_recurrence SET next_run_at = $2, last_spawned_card_id = $3 WHERE card_id = $1`,
      [rule.card_id, nextRun, spawned[0].id]
    );

    await logActivity(client, {
      cardId: spawned[0].id, boardId: rule.board_id, staffId: null, action: "SPAWNED",
      summary: `Spawned automatically from the recurring card "${rule.title}"`,
    });
  }
}

// ── Activity ──────────────────────────────────────────────────────

async function logActivity(client, { cardId, boardId, staffId, action, summary, meta = {} }) {
  await client.query(
    `INSERT INTO card_activity (card_id, board_id, user_id, action, summary, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [cardId, boardId, staffId, action, summary, JSON.stringify(meta)]
  );
}

// ── Search ────────────────────────────────────────────────────────

/** Cross-board search of cards the user has access to. */
async function searchCards(client, user, term) {
  const tasks = user.tasks || [];
  const seeAll = tasks.includes("can_manage_all_boards");

  const { rows } = await client.query(
    `SELECT c.id, c.title, c.board_id, b.name AS board_name, c.list_id, bl.name AS list_name,
            ts_rank(c.search_vector, plainto_tsquery('english', $1)) AS rank
     FROM board_card c
     JOIN board b ON b.id = c.board_id
     JOIN board_list bl ON bl.id = c.list_id
     LEFT JOIN board_member m ON m.board_id = b.id AND m.user_id = $2
     WHERE NOT c.is_archived
       AND c.search_vector @@ plainto_tsquery('english', $1)
       AND (m.user_id IS NOT NULL OR b.visibility = 'ALL' OR $3)
     ORDER BY rank DESC LIMIT 50`,
    [term, user.id, seeAll]
  );
  return rows;
}

module.exports = {
  BoardError,
  PRIORITIES,
  positionBetween,
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  addBoardMember,
  removeBoardMember,
  createList,
  moveList,
  archiveList,
  listCards,
  createCard,
  getCard,
  updateCard,
  moveCard,
  archiveCard,
  deleteCard,
  setCardMembers,
  setCardLabels,
  setCardTags,
  addChecklist,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  addComment,
  resolveComment,
  addLink,
  deleteLink,
  addDependency,
  removeDependency,
  addSubtask,
  startTimer,
  stopTimer,
  addManualTimeEntry,
  setRecurrence,
  clearRecurrence,
  searchCards,
  assertBoardAccess,
  assertBoardEdit,
  assertBoardOwner,
};
