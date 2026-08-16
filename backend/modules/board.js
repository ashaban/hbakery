// modules/board.js
//
// Boards, lists, cards and everything hung off a card. Ported from
// ITSF-IMS's board service so the two behave identically — see
// migrations/018_boards.sql for the deliberate differences (visibility,
// link-based attachments, no notifications) forced by what hbakery has.
//
// The defining decision, copied from ITSF-IMS: getBoard returns the WHOLE
// board in one request — lists, labels, members, statuses, custom fields
// and every card with its counts already denormalised. That is what lets
// the client filter, regroup and switch between kanban/table/calendar/
// gantt/workload instantly with no further round trips.

class BoardError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code || "BOARD_ERROR";
    this.details = details;
  }
}

// ── Ordering ──────────────────────────────────────────────────────

const STEP = 1000;
// Below this the midpoints are close enough to double-precision's limits
// that a further split would start losing precision, so the list is
// renumbered instead.
const MIN_GAP = 0.0001;

function positionBetween(prev, next) {
  if (prev == null && next == null) return STEP;
  if (prev == null) return next - STEP;
  if (next == null) return prev + STEP;
  return (prev + next) / 2;
}

function needsRebalance(prev, next) {
  return prev != null && next != null && Math.abs(next - prev) < MIN_GAP;
}

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
  // The see-everything override never applies to a PRIVATE board — that
  // would defeat the only thing "private" means.
  if (tasks.includes("can_manage_all_boards") && board.visibility !== "PRIVATE") {
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

async function assertBoardEdit(client, user, boardId) {
  const found = await assertBoardAccess(client, user, boardId);
  if (found.role === "OBSERVER") {
    throw new BoardError("You have read-only access to this board", "FORBIDDEN");
  }
  return found;
}

async function assertBoardOwner(client, user, boardId) {
  const found = await assertBoardAccess(client, user, boardId);
  if (found.role !== "OWNER") {
    throw new BoardError("Only a board owner can do that", "FORBIDDEN");
  }
  return found;
}

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

async function listBoards(client, user, { archived = false } = {}) {
  const tasks = user.tasks || [];
  const seeAll = tasks.includes("can_manage_all_boards");

  const { rows } = await client.query(
    `SELECT b.*, m.role AS my_role,
            (SELECT COUNT(*)::int FROM board_card c
              WHERE c.board_id = b.id AND NOT c.is_archived) AS card_count,
            (SELECT COUNT(*)::int FROM board_member bm WHERE bm.board_id = b.id) AS member_count,
            (SELECT COUNT(*)::int FROM board_card c
               JOIN card_member cm ON cm.card_id = c.id
              WHERE c.board_id = b.id AND NOT c.is_archived AND cm.user_id = $1) AS my_card_count,
            COALESCE((
              SELECT json_agg(json_build_object('staff_id', bm2.user_id, 'full_name', u2.name))
              FROM board_member bm2 JOIN users u2 ON u2.id = bm2.user_id
              WHERE bm2.board_id = b.id
            ), '[]') AS members
     FROM board b
     LEFT JOIN board_member m ON m.board_id = b.id AND m.user_id = $1
     WHERE b.is_archived = $3 AND NOT b.is_template
       AND (m.user_id IS NOT NULL OR b.visibility = 'ALL' OR ($2 AND b.visibility <> 'PRIVATE'))
     ORDER BY b.updated_at DESC`,
    [user.id, seeAll, archived]
  );
  return rows;
}

async function createBoard(client, user, { name, description, visibility, linked_card_id }) {
  if (!name?.trim()) throw new BoardError("A board name is required", "INVALID");

  const { rows } = await client.query(
    `INSERT INTO board (name, description, visibility, linked_card_id, created_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [
      name.trim(),
      description || null,
      visibility === "ALL" ? "ALL" : "PRIVATE",
      linked_card_id || null,
      user.id,
    ]
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

  // Trello's three starting columns — an empty board with no lists gives
  // someone nowhere to put the first card.
  for (const [i, listName] of ["To do", "Doing", "Done"].entries()) {
    await client.query(
      `INSERT INTO board_list (board_id, name, "position") VALUES ($1,$2,$3)`,
      [board.id, listName, (i + 1) * STEP]
    );
  }

  return board;
}

/**
 * The whole board in one payload. Every count a card front shows is
 * computed here rather than fetched per card, so the client never issues
 * a second request to render the board.
 */
const CARD_SELECT = `
  SELECT c.id, c.board_id, c.list_id, c.status_id, c.title, c."position",
         c.priority, c.is_milestone, c.start_at, c.due_at, c.due_complete,
         c.estimate_minutes, c.cover_color, c.parent_card_id, c.is_archived,
         c.submitted_by_name, c.created_at, c.updated_at,
         (c.description IS NOT NULL AND c.description <> '') AS has_description,
         COALESCE((SELECT json_agg(cl.label_id) FROM card_label cl WHERE cl.card_id = c.id), '[]') AS label_ids,
         COALESCE((SELECT json_agg(cm.user_id) FROM card_member cm WHERE cm.card_id = c.id), '[]') AS member_ids,
         COALESCE((
           SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
           FROM card_tag ct JOIN tag t ON t.id = ct.tag_id WHERE ct.card_id = c.id
         ), '[]') AS tags,
         COALESCE((
           SELECT json_object_agg(cv.field_id, cv.value)
           FROM card_custom_value cv WHERE cv.card_id = c.id
         ), '{}') AS custom,
         (SELECT COUNT(*)::int FROM card_comment cc WHERE cc.card_id = c.id AND NOT cc.is_deleted) AS comment_count,
         (SELECT COUNT(*)::int FROM card_link cx WHERE cx.card_id = c.id) AS attachment_count,
         (SELECT COUNT(*)::int FROM card_checklist_item i
            JOIN card_checklist cl2 ON cl2.id = i.checklist_id WHERE cl2.card_id = c.id) AS checklist_total,
         (SELECT COUNT(*)::int FROM card_checklist_item i
            JOIN card_checklist cl2 ON cl2.id = i.checklist_id
           WHERE cl2.card_id = c.id AND i.is_done) AS checklist_done,
         (SELECT COUNT(*)::int FROM board_card sub
           WHERE sub.parent_card_id = c.id AND NOT sub.is_archived) AS subtask_total,
         (SELECT COUNT(*)::int FROM board_card sub
            JOIN board_status ss ON ss.id = sub.status_id
           WHERE sub.parent_card_id = c.id AND NOT sub.is_archived AND ss.category = 'DONE') AS subtask_done,
         EXISTS (
           SELECT 1 FROM card_dependency d
             JOIN board_card bc ON bc.id = d.blocker_card_id
             LEFT JOIN board_status bs ON bs.id = bc.status_id
            WHERE d.blocked_card_id = c.id AND COALESCE(bs.category, 'TODO') <> 'DONE'
         ) AS is_blocked,
         EXISTS (SELECT 1 FROM card_watcher w WHERE w.card_id = c.id AND w.user_id = $2) AS watching
  FROM board_card c
`;

async function getBoard(client, user, boardId) {
  const { board, role } = await assertBoardAccess(client, user, boardId);
  await spawnDueRecurrences(client, boardId);

  const [
    { rows: lists },
    { rows: labels },
    { rows: statuses },
    { rows: customFields },
    { rows: members },
    { rows: cards },
    { rows: linked },
  ] = await Promise.all([
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
      `SELECT bm.user_id AS staff_id, bm.role, u.name AS full_name
       FROM board_member bm JOIN users u ON u.id = bm.user_id
       WHERE bm.board_id = $1 ORDER BY u.name`,
      [boardId]
    ),
    client.query(
      `${CARD_SELECT} WHERE c.board_id = $1 AND NOT c.is_archived ORDER BY c."position"`,
      [boardId, user.id]
    ),
    client.query(
      `SELECT bc.id, bc.title, bc.board_id, b2.name AS board_name
       FROM board b JOIN board_card bc ON bc.id = b.linked_card_id
       JOIN board b2 ON b2.id = bc.board_id
       WHERE b.id = $1`,
      [boardId]
    ),
  ]);

  return {
    ...board,
    my_role: role,
    linked_card: linked[0] || null,
    lists,
    labels,
    statuses,
    custom_fields: customFields,
    members,
    cards,
  };
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
  if (!userId) throw new BoardError("Choose someone to add", "INVALID");
  const { rows } = await client.query(
    `INSERT INTO board_member (board_id, user_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [boardId, userId, ["OWNER", "MEMBER", "OBSERVER"].includes(role) ? role : "MEMBER"]
  );
  return rows[0];
}

async function removeBoardMember(client, user, boardId, targetUserId) {
  const { role: ownRole } = await assertBoardAccess(client, user, boardId);
  // Leaving a board yourself needs no special rights; removing someone
  // else does.
  if (Number(targetUserId) !== user.id && ownRole !== "OWNER") {
    throw new BoardError("Only a board owner can remove another member", "FORBIDDEN");
  }
  const { rows: owners } = await client.query(
    `SELECT COUNT(*)::int AS n FROM board_member WHERE board_id = $1 AND role = 'OWNER'`,
    [boardId]
  );
  const { rows: target } = await client.query(
    `SELECT role FROM board_member WHERE board_id = $1 AND user_id = $2`,
    [boardId, targetUserId]
  );
  if (target[0]?.role === "OWNER" && owners[0].n <= 1) {
    throw new BoardError("A board must keep at least one owner", "LAST_OWNER");
  }
  await client.query(`DELETE FROM board_member WHERE board_id = $1 AND user_id = $2`, [
    boardId,
    targetUserId,
  ]);
}

// ── Lists ─────────────────────────────────────────────────────────

async function createList(client, user, boardId, { name }) {
  await assertBoardEdit(client, user, boardId);
  if (!name?.trim()) throw new BoardError("A list name is required", "INVALID");

  const { rows: last } = await client.query(
    `SELECT "position" FROM board_list WHERE board_id = $1 AND NOT is_archived
     ORDER BY "position" DESC LIMIT 1`,
    [boardId]
  );
  const { rows } = await client.query(
    `INSERT INTO board_list (board_id, name, "position") VALUES ($1,$2,$3) RETURNING *`,
    [boardId, name.trim(), positionBetween(last[0]?.position ?? null, null)]
  );
  return rows[0];
}

async function updateList(client, user, listId, { name, color }) {
  const { rows: found } = await client.query(`SELECT * FROM board_list WHERE id = $1`, [listId]);
  if (!found[0]) throw new BoardError("List not found", "NOT_FOUND");
  await assertBoardEdit(client, user, found[0].board_id);

  const { rows } = await client.query(
    `UPDATE board_list SET name = COALESCE($2, name), color = $3 WHERE id = $1 RETURNING *`,
    [listId, name?.trim(), color === undefined ? found[0].color : color]
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
  const prev = await neighbour(after_id);
  const next = await neighbour(before_id);

  await client.query(`UPDATE board_list SET "position" = $2 WHERE id = $1`, [
    listId,
    positionBetween(prev, next),
  ]);
  if (needsRebalance(prev, next)) await rebalance(client, "board_list", "board_id", list.board_id);

  const { rows: positions } = await client.query(
    `SELECT id, "position" FROM board_list WHERE board_id = $1 AND NOT is_archived ORDER BY "position"`,
    [list.board_id]
  );
  return positions;
}

async function archiveList(client, user, listId) {
  const { rows } = await client.query(`SELECT * FROM board_list WHERE id = $1`, [listId]);
  const list = rows[0];
  if (!list) throw new BoardError("List not found", "NOT_FOUND");
  await assertBoardEdit(client, user, list.board_id);
  await client.query(`UPDATE board_list SET is_archived = true WHERE id = $1`, [listId]);
  // A list's cards go with it — leaving them behind would put them in a
  // column that no longer exists.
  await client.query(`UPDATE board_card SET is_archived = true WHERE list_id = $1`, [listId]);
}

async function restoreList(client, user, listId) {
  const { rows } = await client.query(`SELECT * FROM board_list WHERE id = $1`, [listId]);
  if (!rows[0]) throw new BoardError("List not found", "NOT_FOUND");
  await assertBoardEdit(client, user, rows[0].board_id);
  await client.query(`UPDATE board_list SET is_archived = false WHERE id = $1`, [listId]);
}

// ── Statuses ──────────────────────────────────────────────────────

async function moveStatus(client, user, statusId, { before_id, after_id }) {
  const { rows } = await client.query(`SELECT * FROM board_status WHERE id = $1`, [statusId]);
  const status = rows[0];
  if (!status) throw new BoardError("Status not found", "NOT_FOUND");
  await assertBoardOwner(client, user, status.board_id);

  const neighbour = async (id) => {
    if (!id) return null;
    const { rows: n } = await client.query(`SELECT "position" FROM board_status WHERE id = $1`, [id]);
    return n[0]?.position ?? null;
  };
  const prev = await neighbour(after_id);
  const next = await neighbour(before_id);

  await client.query(`UPDATE board_status SET "position" = $2 WHERE id = $1`, [
    statusId,
    positionBetween(prev, next),
  ]);
  if (needsRebalance(prev, next)) {
    await rebalance(client, "board_status", "board_id", status.board_id);
  }

  const { rows: positions } = await client.query(
    `SELECT id, "position" FROM board_status WHERE board_id = $1 ORDER BY "position"`,
    [status.board_id]
  );
  return positions;
}

// ── Cards ─────────────────────────────────────────────────────────

async function oneCard(client, user, cardId) {
  const { rows } = await client.query(`${CARD_SELECT} WHERE c.id = $1`, [cardId, user.id]);
  return rows[0];
}

async function createCard(client, user, boardId, { list_id, title, parent_card_id, assignee_id }) {
  await assertBoardEdit(client, user, boardId);
  if (!title?.trim()) throw new BoardError("A card title is required", "INVALID");

  const { rows: listRow } = await client.query(
    `SELECT id FROM board_list WHERE id = $1 AND board_id = $2`,
    [list_id, boardId]
  );
  if (!listRow[0]) throw new BoardError("That list is not on this board", "INVALID");

  const { rows: firstStatus } = await client.query(
    `SELECT id FROM board_status WHERE board_id = $1 ORDER BY "position" LIMIT 1`,
    [boardId]
  );
  const { rows: last } = await client.query(
    `SELECT "position" FROM board_card WHERE list_id = $1 AND NOT is_archived
     ORDER BY "position" DESC LIMIT 1`,
    [list_id]
  );

  const { rows } = await client.query(
    `INSERT INTO board_card (board_id, list_id, status_id, title, "position", parent_card_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      boardId,
      list_id,
      firstStatus[0]?.id || null,
      title.trim(),
      positionBetween(last[0]?.position ?? null, null),
      parent_card_id || null,
      user.id,
    ]
  );
  const cardId = rows[0].id;

  // Whoever creates a card is watching it — otherwise they never hear
  // about the thing they just asked for.
  await client.query(
    `INSERT INTO card_watcher (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [cardId, user.id]
  );
  if (assignee_id) {
    await client.query(
      `INSERT INTO card_member (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [cardId, assignee_id]
    );
  }

  await logActivity(client, {
    cardId, boardId, userId: user.id, action: "CREATED",
    summary: `${user.name} added this card`,
  });

  return oneCard(client, user, cardId);
}

/** Full card detail — the "back" of the card. */
async function getCard(client, user, cardId) {
  await cardBoard(client, user, cardId);

  const { rows: base } = await client.query(
    `SELECT c.*, bl.name AS list_name, u.name AS created_by_name,
            EXISTS (SELECT 1 FROM card_watcher w WHERE w.card_id = c.id AND w.user_id = $2) AS watching
     FROM board_card c
     JOIN board_list bl ON bl.id = c.list_id
     LEFT JOIN users u ON u.id = c.created_by
     WHERE c.id = $1`,
    [cardId, user.id]
  );
  const card = base[0];

  const [
    { rows: labels },
    { rows: members },
    { rows: tags },
    { rows: custom },
    { rows: checklists },
    { rows: items },
    { rows: comments },
    { rows: mentions },
    { rows: reactions },
    { rows: links },
    { rows: blockedBy },
    { rows: blocking },
    { rows: subtasks },
    { rows: activity },
    { rows: timeEntries },
    { rows: recurrence },
    { rows: linkedBoards },
  ] = await Promise.all([
    client.query(
      `SELECT bl.* FROM card_label cl JOIN board_label bl ON bl.id = cl.label_id WHERE cl.card_id = $1`,
      [cardId]
    ),
    client.query(
      `SELECT cm.user_id AS staff_id, u.name AS full_name
       FROM card_member cm JOIN users u ON u.id = cm.user_id WHERE cm.card_id = $1`,
      [cardId]
    ),
    client.query(
      `SELECT t.* FROM card_tag ct JOIN tag t ON t.id = ct.tag_id WHERE ct.card_id = $1 ORDER BY t.name`,
      [cardId]
    ),
    client.query(`SELECT field_id, value FROM card_custom_value WHERE card_id = $1`, [cardId]),
    client.query(`SELECT * FROM card_checklist WHERE card_id = $1 ORDER BY "position"`, [cardId]),
    client.query(
      `SELECT i.*, u.name AS assignee_name FROM card_checklist_item i
       JOIN card_checklist cl ON cl.id = i.checklist_id
       LEFT JOIN users u ON u.id = i.assignee_id
       WHERE cl.card_id = $1 ORDER BY i."position"`,
      [cardId]
    ),
    client.query(
      `SELECT cm.*, u.name AS author_name,
              a.name AS assigned_to_name, r.name AS resolved_by_name,
              d.name AS deleted_by_name
       FROM card_comment cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN users a ON a.id = cm.assigned_to
       LEFT JOIN users r ON r.id = cm.resolved_by
       LEFT JOIN users d ON d.id = cm.deleted_by
       WHERE cm.card_id = $1 ORDER BY cm.created_at`,
      [cardId]
    ),
    client.query(
      `SELECT cmm.comment_id, cmm.user_id FROM card_comment_mention cmm
       JOIN card_comment cc ON cc.id = cmm.comment_id WHERE cc.card_id = $1`,
      [cardId]
    ),
    client.query(
      `SELECT r.comment_id, r.emoji,
              COUNT(*)::int AS count,
              json_agg(r.user_id) AS staff_ids,
              json_agg(u.name) AS names
       FROM card_comment_reaction r
       JOIN users u ON u.id = r.user_id
       JOIN card_comment cc ON cc.id = r.comment_id
       WHERE cc.card_id = $1
       GROUP BY r.comment_id, r.emoji`,
      [cardId]
    ),
    client.query(
      `SELECT cx.*, u.name AS added_by_name FROM card_link cx
       LEFT JOIN users u ON u.id = cx.added_by
       WHERE cx.card_id = $1 ORDER BY cx.added_at DESC`,
      [cardId]
    ),
    client.query(
      `SELECT bc.id, bc.title, bs.name AS status_name, bs.color AS status_color,
              COALESCE(bs.category, 'TODO') AS status_category
       FROM card_dependency d JOIN board_card bc ON bc.id = d.blocker_card_id
       LEFT JOIN board_status bs ON bs.id = bc.status_id
       WHERE d.blocked_card_id = $1`,
      [cardId]
    ),
    client.query(
      `SELECT bc.id, bc.title, bs.name AS status_name, bs.color AS status_color,
              COALESCE(bs.category, 'TODO') AS status_category
       FROM card_dependency d JOIN board_card bc ON bc.id = d.blocked_card_id
       LEFT JOIN board_status bs ON bs.id = bc.status_id
       WHERE d.blocker_card_id = $1`,
      [cardId]
    ),
    client.query(
      `SELECT c.id, c.title, c.due_at, bs.name AS status_name, bs.color AS status_color,
              COALESCE(bs.category, 'TODO') AS status_category,
              COALESCE((
                SELECT json_agg(u.name) FROM card_member cm JOIN users u ON u.id = cm.user_id
                WHERE cm.card_id = c.id
              ), '[]') AS member_names
       FROM board_card c LEFT JOIN board_status bs ON bs.id = c.status_id
       WHERE c.parent_card_id = $1 AND NOT c.is_archived ORDER BY c."position"`,
      [cardId]
    ),
    client.query(
      `SELECT a.*, u.name AS user_name FROM card_activity a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.card_id = $1 ORDER BY a.created_at DESC LIMIT 60`,
      [cardId]
    ),
    client.query(
      `SELECT t.*, u.name AS staff_name, t.user_id AS staff_id FROM card_time_entry t
       JOIN users u ON u.id = t.user_id WHERE t.card_id = $1 ORDER BY t.started_at DESC`,
      [cardId]
    ),
    client.query(`SELECT * FROM card_recurrence WHERE card_id = $1`, [cardId]),
    client.query(`SELECT id, name, is_archived FROM board WHERE linked_card_id = $1`, [cardId]),
  ]);

  const reactionsByComment = new Map();
  for (const r of reactions) {
    if (!reactionsByComment.has(r.comment_id)) reactionsByComment.set(r.comment_id, []);
    reactionsByComment.get(r.comment_id).push(r);
  }

  const decorate = (c) => ({
    ...c,
    // The client compares these against its own user id to decide what
    // it may edit, so they keep the staff_id/author naming ITSF-IMS uses.
    staff_id: c.user_id,
    assigned_to_id: c.assigned_to,
    mention_ids: mentions.filter((m) => m.comment_id === c.id).map((m) => m.user_id),
    reactions: reactionsByComment.get(c.id) || [],
  });

  const roots = comments.filter((c) => !c.parent_id).map(decorate);
  for (const root of roots) {
    root.replies = comments.filter((c) => c.parent_id === root.id).map(decorate);
  }

  const logged = timeEntries
    .filter((t) => t.minutes)
    .reduce((sum, t) => sum + Number(t.minutes), 0);

  return {
    ...card,
    labels,
    members,
    tags,
    custom: Object.fromEntries(custom.map((c) => [c.field_id, c.value])),
    checklists: checklists.map((cl) => ({
      ...cl,
      items: items.filter((i) => i.checklist_id === cl.id),
    })),
    comments: roots,
    attachments: links,
    blocked_by: blockedBy,
    blocking,
    subtasks,
    activity,
    linked_boards: linkedBoards,
    time: {
      entries: timeEntries,
      logged_minutes: logged,
      running: timeEntries.find((t) => !t.ended_at) || null,
    },
    recurrence: recurrence[0] || null,
  };
}

const CARD_PATCH_FIELDS = [
  "title", "description", "status_id", "priority", "is_milestone",
  "start_at", "due_at", "due_complete", "cover_color",
];

async function updateCard(client, user, cardId, patch) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });

  // Completing a card that is still waiting on another is a legitimate
  // call, but it should be a decision — the client re-sends with force
  // after asking.
  if (patch.status_id && !patch.force) {
    const { rows: target } = await client.query(
      `SELECT category FROM board_status WHERE id = $1`,
      [patch.status_id]
    );
    if (target[0]?.category === "DONE") {
      const { rows: blockers } = await client.query(
        `SELECT bc.title FROM card_dependency d
         JOIN board_card bc ON bc.id = d.blocker_card_id
         LEFT JOIN board_status bs ON bs.id = bc.status_id
         WHERE d.blocked_card_id = $1 AND COALESCE(bs.category, 'TODO') <> 'DONE'`,
        [cardId]
      );
      if (blockers.length) {
        throw new BoardError("This card is still waiting on another", "BLOCKED", {
          blocked_by: blockers.map((b) => b.title),
        });
      }
    }
  }

  // Only the description guards against a stale overwrite — it is the
  // one field where two people can lose real work.
  if (patch.expected_updated_at) {
    const current = new Date(card.updated_at).getTime();
    const expected = new Date(patch.expected_updated_at).getTime();
    if (current !== expected) {
      throw new BoardError("This card changed while you were editing", "STALE", {
        reason: "stale",
      });
    }
  }

  const sets = [];
  const params = [cardId];
  for (const key of CARD_PATCH_FIELDS) {
    if (!(key in patch)) continue;
    params.push(patch[key]);
    sets.push(`${key} = $${params.length}`);
  }
  if (sets.length) {
    await client.query(
      `UPDATE board_card SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $1`,
      params
    );
  }

  if (patch.status_id && patch.status_id !== card.status_id) {
    const { rows: name } = await client.query(`SELECT name FROM board_status WHERE id = $1`, [
      patch.status_id,
    ]);
    await logActivity(client, {
      cardId, boardId: card.board_id, userId: user.id, action: "STATUS",
      summary: `${user.name} set the status to ${name[0]?.name}`,
    });
  }

  const { rows } = await client.query(
    `SELECT c.*, (c.description IS NOT NULL AND c.description <> '') AS has_description
     FROM board_card c WHERE c.id = $1`,
    [cardId]
  );
  return rows[0];
}

async function moveCard(client, user, cardId, { list_id, before_id, after_id }) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });

  let listId = card.list_id;
  if (list_id && Number(list_id) !== card.list_id) {
    const { rows: listRow } = await client.query(
      `SELECT id FROM board_list WHERE id = $1 AND board_id = $2`,
      [list_id, card.board_id]
    );
    if (!listRow[0]) throw new BoardError("That list is not on this board", "INVALID");
    listId = Number(list_id);
  }

  const neighbour = async (id) => {
    if (!id) return null;
    const { rows: n } = await client.query(`SELECT "position" FROM board_card WHERE id = $1`, [id]);
    return n[0]?.position ?? null;
  };
  const prev = await neighbour(after_id);
  const next = await neighbour(before_id);

  await client.query(
    `UPDATE board_card SET list_id = $2, "position" = $3, updated_at = NOW() WHERE id = $1`,
    [cardId, listId, positionBetween(prev, next)]
  );
  if (needsRebalance(prev, next)) await rebalance(client, "board_card", "list_id", listId);

  if (listId !== card.list_id) {
    const { rows: listName } = await client.query(`SELECT name FROM board_list WHERE id = $1`, [listId]);
    await logActivity(client, {
      cardId, boardId: card.board_id, userId: user.id, action: "MOVED",
      summary: `${user.name} moved this card to "${listName[0]?.name}"`,
    });
  }

  const { rows } = await client.query(
    `SELECT id, list_id, "position" FROM board_card WHERE id = $1`,
    [cardId]
  );
  return rows[0];
}

async function archiveCard(client, user, cardId, archived = true) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  await client.query(`UPDATE board_card SET is_archived = $2, updated_at = NOW() WHERE id = $1`, [
    cardId,
    archived,
  ]);
  await logActivity(client, {
    cardId, boardId: card.board_id, userId: user.id,
    action: archived ? "ARCHIVED" : "RESTORED",
    summary: `${user.name} ${archived ? "archived" : "restored"} this card`,
  });
}

/** Duplicates a card with its labels, members, checklists and custom values. */
async function copyCard(client, user, cardId, title) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });

  const { rows: last } = await client.query(
    `SELECT "position" FROM board_card WHERE list_id = $1 AND NOT is_archived
     ORDER BY "position" DESC LIMIT 1`,
    [card.list_id]
  );

  const { rows } = await client.query(
    `INSERT INTO board_card
       (board_id, list_id, status_id, title, description, "position", priority,
        is_milestone, start_at, due_at, estimate_minutes, cover_color, created_by)
     SELECT board_id, list_id, status_id, $2, description, $3, priority,
            is_milestone, start_at, due_at, estimate_minutes, cover_color, $4
     FROM board_card WHERE id = $1 RETURNING id`,
    [
      cardId,
      title?.trim() || `${card.title} (copy)`,
      positionBetween(last[0]?.position ?? null, null),
      user.id,
    ]
  );
  const newId = rows[0].id;

  await client.query(
    `INSERT INTO card_label (card_id, label_id) SELECT $2, label_id FROM card_label WHERE card_id = $1`,
    [cardId, newId]
  );
  await client.query(
    `INSERT INTO card_member (card_id, user_id) SELECT $2, user_id FROM card_member WHERE card_id = $1`,
    [cardId, newId]
  );
  await client.query(
    `INSERT INTO card_tag (card_id, tag_id) SELECT $2, tag_id FROM card_tag WHERE card_id = $1`,
    [cardId, newId]
  );
  await client.query(
    `INSERT INTO card_custom_value (card_id, field_id, value)
     SELECT $2, field_id, value FROM card_custom_value WHERE card_id = $1`,
    [cardId, newId]
  );

  // Checklists come along, but every step starts unticked — the point of
  // copying a card is the work, not its history.
  const { rows: lists } = await client.query(
    `SELECT * FROM card_checklist WHERE card_id = $1 ORDER BY "position"`,
    [cardId]
  );
  for (const list of lists) {
    const { rows: created } = await client.query(
      `INSERT INTO card_checklist (card_id, name, "position") VALUES ($1,$2,$3) RETURNING id`,
      [newId, list.name, list.position]
    );
    await client.query(
      `INSERT INTO card_checklist_item (checklist_id, content, "position", assignee_id)
       SELECT $2, content, "position", assignee_id FROM card_checklist_item WHERE checklist_id = $1`,
      [list.id, created[0].id]
    );
  }

  await client.query(
    `INSERT INTO card_watcher (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [newId, user.id]
  );
  await logActivity(client, {
    cardId: newId, boardId: card.board_id, userId: user.id, action: "COPIED",
    summary: `${user.name} copied this from "${card.title}"`,
  });

  return oneCard(client, user, newId);
}

/** Turns a subtask into a card of its own. */
async function promoteCard(client, user, cardId) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  if (!card.parent_card_id) throw new BoardError("This is already a top-level card", "INVALID");
  await client.query(`UPDATE board_card SET parent_card_id = NULL WHERE id = $1`, [cardId]);
  await logActivity(client, {
    cardId, boardId: card.board_id, userId: user.id, action: "PROMOTED",
    summary: `${user.name} made this a card of its own`,
  });
  return oneCard(client, user, cardId);
}

/** One change across every ticked card. */
async function bulkCards(client, user, cardIds, action, value) {
  if (!Array.isArray(cardIds) || !cardIds.length) {
    throw new BoardError("No cards were selected", "INVALID");
  }
  const { rows: cards } = await client.query(
    `SELECT id, board_id FROM board_card WHERE id = ANY($1::int[])`,
    [cardIds]
  );
  // Every card must be one this person may edit — a bulk action is not a
  // way around the per-board rules.
  const boardIds = [...new Set(cards.map((c) => c.board_id))];
  for (const boardId of boardIds) await assertBoardEdit(client, user, boardId);

  const ids = cards.map((c) => c.id);
  switch (action) {
    case "assign":
      for (const id of ids) {
        await client.query(
          `INSERT INTO card_member (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [id, value]
        );
      }
      break;
    case "unassign":
      await client.query(
        `DELETE FROM card_member WHERE card_id = ANY($1::int[]) AND user_id = $2`,
        [ids, value]
      );
      break;
    case "label":
      for (const id of ids) {
        await client.query(
          `INSERT INTO card_label (card_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [id, value]
        );
      }
      break;
    case "unlabel":
      await client.query(
        `DELETE FROM card_label WHERE card_id = ANY($1::int[]) AND label_id = $2`,
        [ids, value]
      );
      break;
    case "status":
      await client.query(
        `UPDATE board_card SET status_id = $2, updated_at = NOW() WHERE id = ANY($1::int[])`,
        [ids, value]
      );
      break;
    case "priority":
      await client.query(
        `UPDATE board_card SET priority = $2, updated_at = NOW() WHERE id = ANY($1::int[])`,
        [ids, value]
      );
      break;
    case "move":
      await client.query(
        `UPDATE board_card SET list_id = $2, updated_at = NOW() WHERE id = ANY($1::int[])`,
        [ids, value]
      );
      break;
    case "due":
      await client.query(
        `UPDATE board_card SET due_at = $2, due_complete = false, updated_at = NOW() WHERE id = ANY($1::int[])`,
        [ids, value]
      );
      break;
    case "archive":
      await client.query(
        `UPDATE board_card SET is_archived = true, updated_at = NOW() WHERE id = ANY($1::int[])`,
        [ids]
      );
      break;
    default:
      throw new BoardError("Unknown bulk action", "INVALID");
  }
  return ids.length;
}

// ── Card sub-resources ────────────────────────────────────────────

async function toggleLabel(client, user, cardId, labelId, on) {
  await cardBoard(client, user, cardId, { edit: true });
  if (on) {
    await client.query(
      `INSERT INTO card_label (card_id, label_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [cardId, labelId]
    );
  } else {
    await client.query(`DELETE FROM card_label WHERE card_id = $1 AND label_id = $2`, [
      cardId,
      labelId,
    ]);
  }
}

async function toggleMember(client, user, cardId, memberId, on) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  if (on) {
    await client.query(
      `INSERT INTO card_member (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [cardId, memberId]
    );
    // Being given a card subscribes you to it.
    await client.query(
      `INSERT INTO card_watcher (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [cardId, memberId]
    );
    const { rows: who } = await client.query(`SELECT name FROM users WHERE id = $1`, [memberId]);
    await logActivity(client, {
      cardId, boardId: card.board_id, userId: user.id, action: "ASSIGNED",
      summary: `${user.name} assigned this to ${who[0]?.name}`,
    });
  } else {
    await client.query(`DELETE FROM card_member WHERE card_id = $1 AND user_id = $2`, [
      cardId,
      memberId,
    ]);
  }
}

async function toggleWatch(client, user, cardId, on) {
  await cardBoard(client, user, cardId);
  if (on) {
    await client.query(
      `INSERT INTO card_watcher (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [cardId, user.id]
    );
  } else {
    await client.query(`DELETE FROM card_watcher WHERE card_id = $1 AND user_id = $2`, [
      cardId,
      user.id,
    ]);
  }
}

async function addTag(client, user, cardId, name) {
  await cardBoard(client, user, cardId, { edit: true });
  const value = String(name || "").trim();
  if (!value) throw new BoardError("A tag name is required", "INVALID");
  const { rows } = await client.query(
    `INSERT INTO tag (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [value]
  );
  await client.query(
    `INSERT INTO card_tag (card_id, tag_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [cardId, rows[0].id]
  );
  const { rows: tags } = await client.query(
    `SELECT t.* FROM card_tag ct JOIN tag t ON t.id = ct.tag_id WHERE ct.card_id = $1 ORDER BY t.name`,
    [cardId]
  );
  return tags;
}

async function removeTag(client, user, cardId, tagId) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_tag WHERE card_id = $1 AND tag_id = $2`, [cardId, tagId]);
  const { rows } = await client.query(
    `SELECT t.* FROM card_tag ct JOIN tag t ON t.id = ct.tag_id WHERE ct.card_id = $1 ORDER BY t.name`,
    [cardId]
  );
  return rows;
}

async function setCustomValue(client, user, cardId, fieldId, value) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(
    `INSERT INTO card_custom_value (card_id, field_id, value) VALUES ($1,$2,$3)
     ON CONFLICT (card_id, field_id) DO UPDATE SET value = EXCLUDED.value`,
    [cardId, fieldId, JSON.stringify(value ?? null)]
  );
}

// ── Checklists ────────────────────────────────────────────────────

async function addChecklist(client, user, cardId, name) {
  await cardBoard(client, user, cardId, { edit: true });
  const { rows: last } = await client.query(
    `SELECT "position" FROM card_checklist WHERE card_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [cardId]
  );
  const { rows } = await client.query(
    `INSERT INTO card_checklist (card_id, name, "position") VALUES ($1,$2,$3) RETURNING *`,
    [cardId, name?.trim() || "Checklist", positionBetween(last[0]?.position ?? null, null)]
  );
  return rows[0];
}

async function removeChecklist(client, user, cardId, checklistId) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_checklist WHERE id = $1 AND card_id = $2`, [
    checklistId,
    cardId,
  ]);
}

async function addChecklistItem(client, user, cardId, checklistId, { content }) {
  await cardBoard(client, user, cardId, { edit: true });
  if (!content?.trim()) throw new BoardError("A step needs some text", "INVALID");
  const { rows: last } = await client.query(
    `SELECT "position" FROM card_checklist_item WHERE checklist_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [checklistId]
  );
  const { rows } = await client.query(
    `INSERT INTO card_checklist_item (checklist_id, content, "position") VALUES ($1,$2,$3) RETURNING *`,
    [checklistId, content.trim(), positionBetween(last[0]?.position ?? null, null)]
  );
  return rows[0];
}

async function updateChecklistItem(client, user, cardId, itemId, patch) {
  await cardBoard(client, user, cardId, { edit: true });
  const sets = [];
  const params = [itemId];

  if ("is_done" in patch) {
    params.push(patch.is_done);
    sets.push(`is_done = $${params.length}`);
    params.push(patch.is_done ? user.id : null);
    sets.push(`done_by = $${params.length}::integer`);
    sets.push(`done_at = ${patch.is_done ? "NOW()" : "NULL"}`);
  }
  if ("assignee_id" in patch) {
    params.push(patch.assignee_id);
    sets.push(`assignee_id = $${params.length}::integer`);
  }
  if ("due_at" in patch) {
    params.push(patch.due_at);
    sets.push(`due_at = $${params.length}::timestamp`);
  }
  if (!sets.length) return;

  await client.query(`UPDATE card_checklist_item SET ${sets.join(", ")} WHERE id = $1`, params);
}

async function removeChecklistItem(client, user, cardId, itemId) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_checklist_item WHERE id = $1`, [itemId]);
}

// ── Comments ──────────────────────────────────────────────────────

// How long after posting a comment may still be edited or deleted.
// Owners get longer with their own, and may remove anyone's outright.
const COMMENT_WINDOW = { member: 10, owner: 60 };

async function addComment(client, user, cardId, { body, assigned_to, parent_id, mentionUserIds = [] }) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  if (!body?.trim()) throw new BoardError("A comment needs some text", "INVALID");

  const { rows } = await client.query(
    `INSERT INTO card_comment (card_id, user_id, body, assigned_to, parent_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [cardId, user.id, body.trim(), assigned_to || null, parent_id || null]
  );
  const comment = rows[0];

  for (const id of mentionUserIds) {
    await client.query(
      `INSERT INTO card_comment_mention (comment_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [comment.id, id]
    );
  }

  // Commenting on a card subscribes you to it, as it does in Trello.
  await client.query(
    `INSERT INTO card_watcher (card_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [cardId, user.id]
  );
  await logActivity(client, {
    cardId, boardId: card.board_id, userId: user.id, action: "COMMENTED",
    summary: `${user.name} commented`,
  });

  return comment;
}

async function editComment(client, user, cardId, commentId, body) {
  const { role } = await cardBoard(client, user, cardId, { edit: true });
  const { rows } = await client.query(`SELECT * FROM card_comment WHERE id = $1`, [commentId]);
  const comment = rows[0];
  if (!comment) throw new BoardError("Comment not found", "NOT_FOUND");
  if (comment.user_id !== user.id) {
    throw new BoardError("You can only edit your own comment", "FORBIDDEN");
  }
  const minutes = (Date.now() - new Date(comment.created_at).getTime()) / 60000;
  if (minutes > (role === "OWNER" ? COMMENT_WINDOW.owner : COMMENT_WINDOW.member)) {
    throw new BoardError("That comment is too old to edit now", "TOO_LATE");
  }
  await client.query(`UPDATE card_comment SET body = $2, updated_at = NOW() WHERE id = $1`, [
    commentId,
    body.trim(),
  ]);
}

async function deleteComment(client, user, cardId, commentId) {
  const { role } = await cardBoard(client, user, cardId, { edit: true });
  const { rows } = await client.query(`SELECT * FROM card_comment WHERE id = $1`, [commentId]);
  const comment = rows[0];
  if (!comment) throw new BoardError("Comment not found", "NOT_FOUND");

  const isOwn = comment.user_id === user.id;
  // An owner moderates anyone's comment; your own is yours only for a
  // grace period, so a thread can't be rewritten days later.
  if (!isOwn && role !== "OWNER") {
    throw new BoardError("You can only delete your own comment", "FORBIDDEN");
  }
  if (isOwn) {
    const minutes = (Date.now() - new Date(comment.created_at).getTime()) / 60000;
    if (minutes > (role === "OWNER" ? COMMENT_WINDOW.owner : COMMENT_WINDOW.member)) {
      throw new BoardError("That comment is too old to delete now", "TOO_LATE");
    }
  }

  await client.query(
    `UPDATE card_comment SET is_deleted = true, deleted_by = $2, deleted_at = NOW() WHERE id = $1`,
    [commentId, user.id]
  );
}

async function resolveComment(client, user, cardId, commentId, resolved) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(
    `UPDATE card_comment
     SET resolved_at = ${resolved ? "NOW()" : "NULL"},
         resolved_by = $2::integer, updated_at = NOW()
     WHERE id = $1`,
    [commentId, resolved ? user.id : null]
  );
}

async function reactToComment(client, user, cardId, commentId, emoji) {
  await cardBoard(client, user, cardId, { edit: true });
  const { rowCount } = await client.query(
    `DELETE FROM card_comment_reaction WHERE comment_id = $1 AND user_id = $2 AND emoji = $3`,
    [commentId, user.id, emoji]
  );
  // Clicking the same emoji again takes your reaction back off.
  if (!rowCount) {
    await client.query(
      `INSERT INTO card_comment_reaction (comment_id, user_id, emoji) VALUES ($1,$2,$3)`,
      [commentId, user.id, emoji]
    );
  }
}

// ── Links (this build's stand-in for file attachments) ─────────────

async function addLink(client, user, cardId, { url, label }) {
  await cardBoard(client, user, cardId, { edit: true });
  if (!url?.trim()) throw new BoardError("A link is required", "INVALID");
  const { rows } = await client.query(
    `INSERT INTO card_link (card_id, url, label, added_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [cardId, url.trim(), label?.trim() || null, user.id]
  );
  return rows[0];
}

async function removeLink(client, user, cardId, linkId) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_link WHERE id = $1 AND card_id = $2`, [linkId, cardId]);
}

// ── Dependencies ──────────────────────────────────────────────────

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

async function dependencyCandidates(client, user, cardId) {
  const { card } = await cardBoard(client, user, cardId);
  const { rows } = await client.query(
    `SELECT id, title FROM board_card
     WHERE board_id = $1 AND NOT is_archived AND id <> $2
       AND id NOT IN (SELECT blocker_card_id FROM card_dependency WHERE blocked_card_id = $2)
     ORDER BY title`,
    [card.board_id, cardId]
  );
  return rows;
}

async function addDependency(client, user, blockedCardId, blockerCardId) {
  // blockedCardId is a route :param (a string); blockerCardId comes from
  // the body. Left uncoerced the checks below compare a string to a
  // number and never match, silently skipping both.
  blockedCardId = Number(blockedCardId);
  blockerCardId = Number(blockerCardId);
  if (!blockerCardId) throw new BoardError("Choose a card to wait on", "INVALID");

  const { card } = await cardBoard(client, user, blockedCardId, { edit: true });
  const { rows: blocker } = await client.query(`SELECT board_id FROM board_card WHERE id = $1`, [
    blockerCardId,
  ]);
  if (!blocker[0]) throw new BoardError("That card was not found", "NOT_FOUND");
  if (blocker[0].board_id !== card.board_id) {
    throw new BoardError("A card can only wait on a card from the same board", "INVALID");
  }
  if (await wouldCreateCycle(client, blockerCardId, blockedCardId)) {
    throw new BoardError("That would make the two cards wait on each other", "CYCLE");
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

// ── Time ──────────────────────────────────────────────────────────

async function setEstimate(client, user, cardId, minutes) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`UPDATE board_card SET estimate_minutes = $2 WHERE id = $1`, [
    cardId,
    minutes == null || minutes === "" ? null : Number(minutes),
  ]);
}

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

async function stopTimer(client, user, cardId) {
  await cardBoard(client, user, cardId, { edit: true });
  const { rows } = await client.query(
    `SELECT * FROM card_time_entry WHERE card_id = $1 AND user_id = $2 AND ended_at IS NULL`,
    [cardId, user.id]
  );
  const entry = rows[0];
  if (!entry) throw new BoardError("No timer is running on this card", "NOT_FOUND");
  const minutes = Math.max(
    1,
    Math.round((Date.now() - new Date(entry.started_at).getTime()) / 60000)
  );
  await client.query(`UPDATE card_time_entry SET ended_at = NOW(), minutes = $2 WHERE id = $1`, [
    entry.id,
    minutes,
  ]);
  return { ...entry, minutes };
}

async function addTimeEntry(client, user, cardId, { minutes, note }) {
  await cardBoard(client, user, cardId, { edit: true });
  if (!(Number(minutes) > 0)) throw new BoardError("How many minutes?", "INVALID");
  const { rows } = await client.query(
    `INSERT INTO card_time_entry (card_id, user_id, started_at, ended_at, minutes, note)
     VALUES ($1,$2,NOW(),NOW(),$3,$4) RETURNING *`,
    [cardId, user.id, Number(minutes), note || null]
  );
  return rows[0];
}

async function removeTimeEntry(client, user, cardId, entryId) {
  await cardBoard(client, user, cardId, { edit: true });
  const { rows } = await client.query(`SELECT * FROM card_time_entry WHERE id = $1`, [entryId]);
  if (!rows[0]) return;
  if (rows[0].user_id !== user.id) throw new BoardError("That is not your time entry", "FORBIDDEN");
  await client.query(`DELETE FROM card_time_entry WHERE id = $1`, [entryId]);
}

// ── Recurrence ────────────────────────────────────────────────────

function nextRunAfter(from, rule) {
  const d = new Date(from);
  const step = Number(rule.interval) || 1;
  if (rule.freq === "DAILY") d.setDate(d.getDate() + step);
  else if (rule.freq === "WEEKLY") d.setDate(d.getDate() + 7 * step);
  else if (rule.freq === "MONTHLY") d.setMonth(d.getMonth() + step);
  else if (rule.freq === "QUARTERLY") d.setMonth(d.getMonth() + 3 * step);
  else if (rule.freq === "YEARLY") d.setFullYear(d.getFullYear() + step);
  return d;
}

async function setRecurrence(client, user, cardId, rule) {
  const { card } = await cardBoard(client, user, cardId, { edit: true });
  if (card.parent_card_id) throw new BoardError("Only a top-level card can repeat", "INVALID");
  const nextRun = nextRunAfter(new Date(), rule);
  const { rows } = await client.query(
    `INSERT INTO card_recurrence (card_id, freq, "interval", weekdays, day_of_month, next_run_at, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (card_id) DO UPDATE SET
       freq = EXCLUDED.freq, "interval" = EXCLUDED.interval, weekdays = EXCLUDED.weekdays,
       day_of_month = EXCLUDED.day_of_month, next_run_at = EXCLUDED.next_run_at,
       ends_at = EXCLUDED.ends_at
     RETURNING *`,
    [
      cardId,
      rule.freq,
      Number(rule.interval) || 1,
      rule.weekdays?.length ? rule.weekdays : null,
      rule.day_of_month || null,
      nextRun,
      rule.ends_at || null,
      user.id,
    ]
  );
  return rows[0];
}

async function clearRecurrence(client, user, cardId) {
  await cardBoard(client, user, cardId, { edit: true });
  await client.query(`DELETE FROM card_recurrence WHERE card_id = $1`, [cardId]);
}

/**
 * Checked whenever a board is read rather than by a cron sweeper —
 * hbakery's server has no job scheduler, and for an internal tool "due
 * the next time someone opens the board" is close enough. At most one
 * card per overdue rule per call, so a board left alone for months does
 * not dump a backlog on return.
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
    const { rows: firstStatus } = await client.query(
      `SELECT id FROM board_status WHERE board_id = $1 ORDER BY "position" LIMIT 1`,
      [rule.board_id]
    );
    const { rows: spawned } = await client.query(
      `INSERT INTO board_card (board_id, list_id, status_id, title, description, "position")
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [
        rule.board_id,
        rule.list_id,
        firstStatus[0]?.id || null,
        rule.title,
        rule.description,
        positionBetween(last[0]?.position ?? null, null),
      ]
    );
    await client.query(
      `UPDATE card_recurrence SET next_run_at = $2, last_spawned_card_id = $3 WHERE card_id = $1`,
      [rule.card_id, nextRunAfter(rule.next_run_at, rule), spawned[0].id]
    );
    await logActivity(client, {
      cardId: spawned[0].id, boardId: rule.board_id, userId: null, action: "SPAWNED",
      summary: `Created automatically from the repeating card "${rule.title}"`,
    });
  }
}

// ── Capacity ──────────────────────────────────────────────────────

async function getCapacity(client, user, boardId) {
  await assertBoardAccess(client, user, boardId);
  const { rows } = await client.query(
    `SELECT user_id, hours FROM board_capacity WHERE board_id = $1`,
    [boardId]
  );
  return {
    default_hours: 40,
    people: Object.fromEntries(rows.map((r) => [r.user_id, { hours: Number(r.hours) }])),
  };
}

async function setCapacity(client, user, boardId, targetUserId, hours) {
  await assertBoardOwner(client, user, boardId);
  if (hours == null || hours === "") {
    await client.query(`DELETE FROM board_capacity WHERE board_id = $1 AND user_id = $2`, [
      boardId,
      targetUserId,
    ]);
  } else {
    await client.query(
      `INSERT INTO board_capacity (board_id, user_id, hours) VALUES ($1,$2,$3)
       ON CONFLICT (board_id, user_id) DO UPDATE SET hours = EXCLUDED.hours`,
      [boardId, targetUserId, hours]
    );
  }
  return getCapacity(client, user, boardId);
}

// ── Archive ───────────────────────────────────────────────────────

async function archivedItems(client, user, boardId) {
  await assertBoardAccess(client, user, boardId);
  const [{ rows: cards }, { rows: lists }] = await Promise.all([
    client.query(
      `SELECT c.id, c.title, c.updated_at, bl.name AS list_name
       FROM board_card c JOIN board_list bl ON bl.id = c.list_id
       WHERE c.board_id = $1 AND c.is_archived ORDER BY c.updated_at DESC`,
      [boardId]
    ),
    client.query(
      `SELECT id, name FROM board_list WHERE board_id = $1 AND is_archived ORDER BY name`,
      [boardId]
    ),
  ]);
  return { cards, lists };
}

// ── Activity + search ─────────────────────────────────────────────

async function logActivity(client, { cardId, boardId, userId, action, summary, meta = {} }) {
  await client.query(
    `INSERT INTO card_activity (card_id, board_id, user_id, action, summary, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [cardId, boardId, userId, action, summary, JSON.stringify(meta)]
  );
}

async function searchCards(client, user, term) {
  const tasks = user.tasks || [];
  const seeAll = tasks.includes("can_manage_all_boards");
  const { rows } = await client.query(
    `SELECT c.id, c.title, c.board_id, b.name AS board_name, bl.name AS list_name,
            ts_rank(c.search_vector, plainto_tsquery('english', $1)) AS rank
     FROM board_card c
     JOIN board b ON b.id = c.board_id
     JOIN board_list bl ON bl.id = c.list_id
     LEFT JOIN board_member m ON m.board_id = b.id AND m.user_id = $2
     WHERE NOT c.is_archived AND NOT b.is_archived
       AND c.search_vector @@ plainto_tsquery('english', $1)
       AND (m.user_id IS NOT NULL OR b.visibility = 'ALL' OR ($3 AND b.visibility <> 'PRIVATE'))
     ORDER BY rank DESC LIMIT 50`,
    [term, user.id, seeAll]
  );
  return rows;
}

/** Cards assigned to this person across every board they can see. */
async function myWork(client, user) {
  const { rows } = await client.query(
    `SELECT c.id, c.title, c.due_at, c.due_complete, c.priority, c.board_id,
            b.name AS board_name, bs.name AS status_name, bs.color AS status_color,
            COALESCE(bs.category, 'TODO') AS status_category
     FROM board_card c
     JOIN card_member cm ON cm.card_id = c.id AND cm.user_id = $1
     JOIN board b ON b.id = c.board_id
     LEFT JOIN board_status bs ON bs.id = c.status_id
     WHERE NOT c.is_archived AND NOT b.is_archived
       AND COALESCE(bs.category, 'TODO') <> 'DONE'
     ORDER BY c.due_at NULLS LAST, c.id`,
    [user.id]
  );
  return rows;
}

module.exports = {
  BoardError,
  PRIORITIES,
  COMMENT_WINDOW,
  positionBetween,
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  addBoardMember,
  removeBoardMember,
  createList,
  updateList,
  moveList,
  archiveList,
  restoreList,
  moveStatus,
  oneCard,
  createCard,
  getCard,
  updateCard,
  moveCard,
  archiveCard,
  copyCard,
  promoteCard,
  bulkCards,
  toggleLabel,
  toggleMember,
  toggleWatch,
  addTag,
  removeTag,
  setCustomValue,
  addChecklist,
  removeChecklist,
  addChecklistItem,
  updateChecklistItem,
  removeChecklistItem,
  addComment,
  editComment,
  deleteComment,
  resolveComment,
  reactToComment,
  addLink,
  removeLink,
  dependencyCandidates,
  addDependency,
  removeDependency,
  setEstimate,
  startTimer,
  stopTimer,
  addTimeEntry,
  removeTimeEntry,
  setRecurrence,
  clearRecurrence,
  getCapacity,
  setCapacity,
  archivedItems,
  searchCards,
  myWork,
  assertBoardAccess,
  assertBoardEdit,
  assertBoardOwner,
};
