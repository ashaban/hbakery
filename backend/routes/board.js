// routes/board.js
//
// Thin HTTP layer over modules/board.js. Endpoint shapes follow
// ITSF-IMS's board API so the ported client works against them
// unchanged — notably GET /boards/:id returning the entire board in one
// response, and card sub-resources being addressed directly
// (/boards/cards/:id/...) rather than nested under their board.

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requireTask } = require("../middleware/auth");
const board = require("../modules/board");

function handleError(res, err, fallback) {
  if (err instanceof board.BoardError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "FORBIDDEN"
        ? 403
        : ["TIMER_RUNNING", "LAST_OWNER", "CYCLE", "BLOCKED", "STALE", "TOO_LATE"].includes(err.code)
        ? 409
        : 400;
    return res.status(status).json({ error: err.message, details: err.details });
  }
  console.error(`❌ ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Wraps a handler so every route gets the same error translation. */
const wrap = (fallback, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    handleError(res, err, fallback);
  }
};

// can_use_boards is granted to every role by migration 018, so this is
// effectively "must be signed in" — it exists so the permission can be
// taken away from a role later without touching code.
router.use(requireTask("can_use_boards"));

// ── Lookups ───────────────────────────────────────────────────────

// The people picker for assigning and mentioning. Deliberately not gated
// by can_see_users, same reasoning as the customer picker on Sales:
// putting someone on a card needs their name, whether or not you
// administer user accounts.
router.get("/users", wrap("Failed to fetch users", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, id AS staff_id, name, name AS full_name FROM users ORDER BY name`
  );
  res.json(rows);
}));

router.get("/tags", wrap("Failed to fetch tags", async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM tag ORDER BY name`);
  res.json(rows);
}));

router.get("/comment-window", wrap("Failed to fetch comment window", async (req, res) => {
  res.json(board.COMMENT_WINDOW);
}));

router.get("/search", wrap("Search failed", async (req, res) => {
  const term = (req.query.q || "").trim();
  res.json(term ? await board.searchCards(pool, req.user, term) : []);
}));

router.get("/my-work", wrap("Failed to fetch your work", async (req, res) => {
  res.json(await board.myWork(pool, req.user));
}));

// ── Boards ────────────────────────────────────────────────────────

router.get("/", wrap("Failed to fetch boards", async (req, res) => {
  res.json(await board.listBoards(pool, req.user, { archived: req.query.archived === "true" }));
}));

router.post("/", wrap("Failed to create board", async (req, res) => {
  res.status(201).json(await tx((c) => board.createBoard(c, req.user, req.body || {})));
}));

// ── Cards (declared before /:id so "cards" is never read as a board id) ──

router.post("/cards/bulk", wrap("Bulk action failed", async (req, res) => {
  const { card_ids, action, value } = req.body || {};
  const count = await tx((c) => board.bulkCards(c, req.user, card_ids, action, value));
  res.json({ count });
}));

router.get("/cards/:cardId", wrap("Failed to fetch card", async (req, res) => {
  res.json(await board.getCard(pool, req.user, req.params.cardId));
}));

router.put("/cards/:cardId", wrap("Failed to update card", async (req, res) => {
  res.json(await tx((c) => board.updateCard(c, req.user, req.params.cardId, req.body || {})));
}));

router.put("/cards/:cardId/move", wrap("Failed to move card", async (req, res) => {
  res.json(await tx((c) => board.moveCard(c, req.user, req.params.cardId, req.body || {})));
}));

router.put("/cards/:cardId/archive", wrap("Failed to archive card", async (req, res) => {
  await tx((c) => board.archiveCard(c, req.user, req.params.cardId, req.body?.archived !== false));
  res.json({ ok: true });
}));

router.post("/cards/:cardId/copy", wrap("Failed to copy card", async (req, res) => {
  res.status(201).json(await tx((c) => board.copyCard(c, req.user, req.params.cardId, req.body?.title)));
}));

router.put("/cards/:cardId/promote", wrap("Failed to promote card", async (req, res) => {
  res.json(await tx((c) => board.promoteCard(c, req.user, req.params.cardId)));
}));

router.post("/cards/:cardId/subtasks", wrap("Failed to add subtask", async (req, res) => {
  const parent = await board.getCard(pool, req.user, req.params.cardId);
  const created = await tx((c) =>
    board.createCard(c, req.user, parent.board_id, {
      list_id: parent.list_id,
      title: req.body?.title,
      parent_card_id: parent.id,
      assignee_id: req.body?.assignee_id,
    })
  );
  res.status(201).json(created);
}));

// Labels / members / watch — POST adds, DELETE removes, matching ITSF-IMS.
router.post("/cards/:cardId/labels/:labelId", wrap("Failed to add label", async (req, res) => {
  await tx((c) => board.toggleLabel(c, req.user, req.params.cardId, req.params.labelId, true));
  res.json({ ok: true });
}));
router.delete("/cards/:cardId/labels/:labelId", wrap("Failed to remove label", async (req, res) => {
  await tx((c) => board.toggleLabel(c, req.user, req.params.cardId, req.params.labelId, false));
  res.json({ ok: true });
}));

router.post("/cards/:cardId/members/:memberId", wrap("Failed to assign", async (req, res) => {
  await tx((c) => board.toggleMember(c, req.user, req.params.cardId, req.params.memberId, true));
  res.json({ ok: true });
}));
router.delete("/cards/:cardId/members/:memberId", wrap("Failed to unassign", async (req, res) => {
  await tx((c) => board.toggleMember(c, req.user, req.params.cardId, req.params.memberId, false));
  res.json({ ok: true });
}));

router.post("/cards/:cardId/watch", wrap("Failed to watch card", async (req, res) => {
  await tx((c) => board.toggleWatch(c, req.user, req.params.cardId, true));
  res.json({ ok: true });
}));
router.delete("/cards/:cardId/watch", wrap("Failed to unwatch card", async (req, res) => {
  await tx((c) => board.toggleWatch(c, req.user, req.params.cardId, false));
  res.json({ ok: true });
}));

router.post("/cards/:cardId/tags", wrap("Failed to add tag", async (req, res) => {
  res.json(await tx((c) => board.addTag(c, req.user, req.params.cardId, req.body?.name)));
}));
router.delete("/cards/:cardId/tags/:tagId", wrap("Failed to remove tag", async (req, res) => {
  res.json(await tx((c) => board.removeTag(c, req.user, req.params.cardId, req.params.tagId)));
}));

router.put("/cards/:cardId/custom-fields/:fieldId", wrap("Failed to set field", async (req, res) => {
  await tx((c) =>
    board.setCustomValue(c, req.user, req.params.cardId, req.params.fieldId, req.body?.value)
  );
  res.json({ ok: true });
}));

// Checklists
router.post("/cards/:cardId/checklists", wrap("Failed to add checklist", async (req, res) => {
  res.status(201).json(await tx((c) => board.addChecklist(c, req.user, req.params.cardId, req.body?.name)));
}));
router.delete("/cards/:cardId/checklists/:checklistId", wrap("Failed to delete checklist", async (req, res) => {
  await tx((c) => board.removeChecklist(c, req.user, req.params.cardId, req.params.checklistId));
  res.json({ ok: true });
}));
router.post("/cards/:cardId/checklists/:checklistId/items", wrap("Failed to add step", async (req, res) => {
  res.status(201).json(
    await tx((c) =>
      board.addChecklistItem(c, req.user, req.params.cardId, req.params.checklistId, req.body || {})
    )
  );
}));
router.put("/cards/:cardId/checklist-items/:itemId", wrap("Failed to update step", async (req, res) => {
  await tx((c) =>
    board.updateChecklistItem(c, req.user, req.params.cardId, req.params.itemId, req.body || {})
  );
  res.json({ ok: true });
}));
router.delete("/cards/:cardId/checklist-items/:itemId", wrap("Failed to delete step", async (req, res) => {
  await tx((c) => board.removeChecklistItem(c, req.user, req.params.cardId, req.params.itemId));
  res.json({ ok: true });
}));

// Comments
router.post("/cards/:cardId/comments", wrap("Failed to add comment", async (req, res) => {
  res.status(201).json(await tx((c) => board.addComment(c, req.user, req.params.cardId, req.body || {})));
}));
router.put("/cards/:cardId/comments/:commentId", wrap("Failed to edit comment", async (req, res) => {
  await tx((c) => board.editComment(c, req.user, req.params.cardId, req.params.commentId, req.body?.body));
  res.json({ ok: true });
}));
router.delete("/cards/:cardId/comments/:commentId", wrap("Failed to delete comment", async (req, res) => {
  await tx((c) => board.deleteComment(c, req.user, req.params.cardId, req.params.commentId));
  res.json({ ok: true });
}));
router.put("/cards/:cardId/comments/:commentId/resolve", wrap("Failed to resolve comment", async (req, res) => {
  await tx((c) =>
    board.resolveComment(c, req.user, req.params.cardId, req.params.commentId, req.body?.resolved !== false)
  );
  res.json({ ok: true });
}));
router.post("/cards/:cardId/comments/:commentId/reactions", wrap("Failed to react", async (req, res) => {
  await tx((c) =>
    board.reactToComment(c, req.user, req.params.cardId, req.params.commentId, req.body?.emoji)
  );
  res.json({ ok: true });
}));

// Links — this build's stand-in for file attachments.
router.post("/cards/:cardId/links", wrap("Failed to add link", async (req, res) => {
  res.status(201).json(await tx((c) => board.addLink(c, req.user, req.params.cardId, req.body || {})));
}));
router.delete("/cards/:cardId/links/:linkId", wrap("Failed to remove link", async (req, res) => {
  await tx((c) => board.removeLink(c, req.user, req.params.cardId, req.params.linkId));
  res.json({ ok: true });
}));

// Dependencies
router.get("/cards/:cardId/dependency-candidates", wrap("Failed to fetch candidates", async (req, res) => {
  res.json(await board.dependencyCandidates(pool, req.user, req.params.cardId));
}));
router.post("/cards/:cardId/dependencies/:blockerId", wrap("Failed to add dependency", async (req, res) => {
  await tx((c) => board.addDependency(c, req.user, req.params.cardId, req.params.blockerId));
  res.status(201).json({ ok: true });
}));
router.delete("/cards/:cardId/dependencies/:blockerId", wrap("Failed to remove dependency", async (req, res) => {
  await tx((c) => board.removeDependency(c, req.user, req.params.cardId, req.params.blockerId));
  res.json({ ok: true });
}));

// Time
router.put("/cards/:cardId/estimate", wrap("Failed to set estimate", async (req, res) => {
  await tx((c) => board.setEstimate(c, req.user, req.params.cardId, req.body?.minutes));
  res.json({ ok: true });
}));
router.post("/cards/:cardId/time/start", wrap("Failed to start timer", async (req, res) => {
  res.status(201).json(await tx((c) => board.startTimer(c, req.user, req.params.cardId)));
}));
router.post("/cards/:cardId/time/stop", wrap("Failed to stop timer", async (req, res) => {
  res.json(await tx((c) => board.stopTimer(c, req.user, req.params.cardId)));
}));
router.post("/cards/:cardId/time", wrap("Failed to log time", async (req, res) => {
  res.status(201).json(await tx((c) => board.addTimeEntry(c, req.user, req.params.cardId, req.body || {})));
}));
router.delete("/cards/:cardId/time/:entryId", wrap("Failed to remove time entry", async (req, res) => {
  await tx((c) => board.removeTimeEntry(c, req.user, req.params.cardId, req.params.entryId));
  res.json({ ok: true });
}));

// Recurrence
router.put("/cards/:cardId/recurrence", wrap("Failed to set repeat", async (req, res) => {
  res.json(await tx((c) => board.setRecurrence(c, req.user, req.params.cardId, req.body || {})));
}));
router.delete("/cards/:cardId/recurrence", wrap("Failed to stop repeat", async (req, res) => {
  await tx((c) => board.clearRecurrence(c, req.user, req.params.cardId));
  res.json({ ok: true });
}));

// ── Lists and statuses (also before /:id) ─────────────────────────

router.put("/lists/:listId", wrap("Failed to update list", async (req, res) => {
  res.json(await tx((c) => board.updateList(c, req.user, req.params.listId, req.body || {})));
}));
router.put("/lists/:listId/move", wrap("Failed to move list", async (req, res) => {
  res.json(await tx((c) => board.moveList(c, req.user, req.params.listId, req.body || {})));
}));
router.delete("/lists/:listId", wrap("Failed to archive list", async (req, res) => {
  await tx((c) => board.archiveList(c, req.user, req.params.listId));
  res.json({ ok: true });
}));
router.put("/lists/:listId/restore", wrap("Failed to restore list", async (req, res) => {
  await tx((c) => board.restoreList(c, req.user, req.params.listId));
  res.json({ ok: true });
}));

router.put("/statuses/:statusId/move", wrap("Failed to move status", async (req, res) => {
  res.json(await tx((c) => board.moveStatus(c, req.user, req.params.statusId, req.body || {})));
}));
router.put("/statuses/:statusId", wrap("Failed to update status", async (req, res) => {
  const { rows: found } = await pool.query(`SELECT board_id FROM board_status WHERE id = $1`, [
    req.params.statusId,
  ]);
  if (!found[0]) return res.status(404).json({ error: "Status not found" });
  await board.assertBoardOwner(pool, req.user, found[0].board_id);
  const { name, color, category } = req.body || {};
  const { rows } = await pool.query(
    `UPDATE board_status SET name = COALESCE($2, name), color = COALESCE($3, color),
       category = COALESCE($4, category) WHERE id = $1 RETURNING *`,
    [req.params.statusId, name?.trim(), color, category]
  );
  res.json(rows[0]);
}));
router.delete("/statuses/:statusId", wrap("Failed to delete status", async (req, res) => {
  const { rows: found } = await pool.query(`SELECT board_id FROM board_status WHERE id = $1`, [
    req.params.statusId,
  ]);
  if (!found[0]) return res.status(404).json({ error: "Status not found" });
  await board.assertBoardOwner(pool, req.user, found[0].board_id);
  await pool.query(`DELETE FROM board_status WHERE id = $1`, [req.params.statusId]);
  res.json({ ok: true });
}));

router.delete("/custom-fields/:fieldId", wrap("Failed to delete field", async (req, res) => {
  const { rows: found } = await pool.query(`SELECT board_id FROM board_custom_field WHERE id = $1`, [
    req.params.fieldId,
  ]);
  if (!found[0]) return res.status(404).json({ error: "Field not found" });
  await board.assertBoardOwner(pool, req.user, found[0].board_id);
  await pool.query(`DELETE FROM board_custom_field WHERE id = $1`, [req.params.fieldId]);
  res.json({ ok: true });
}));

router.delete("/labels/:labelId", wrap("Failed to delete label", async (req, res) => {
  const { rows: found } = await pool.query(`SELECT board_id FROM board_label WHERE id = $1`, [
    req.params.labelId,
  ]);
  if (!found[0]) return res.status(404).json({ error: "Label not found" });
  await board.assertBoardEdit(pool, req.user, found[0].board_id);
  await pool.query(`DELETE FROM board_label WHERE id = $1`, [req.params.labelId]);
  res.json({ ok: true });
}));

router.delete("/views/:viewId", wrap("Failed to delete view", async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM board_view WHERE id = $1`, [req.params.viewId]);
  if (!rows[0]) return res.status(404).json({ error: "View not found" });
  if (rows[0].created_by !== req.user.id) {
    await board.assertBoardOwner(pool, req.user, rows[0].board_id);
  }
  await pool.query(`DELETE FROM board_view WHERE id = $1`, [req.params.viewId]);
  res.json({ ok: true });
}));

// ── One board ─────────────────────────────────────────────────────

router.get("/:id", wrap("Failed to fetch board", async (req, res) => {
  res.json(await tx((c) => board.getBoard(c, req.user, req.params.id)));
}));

router.put("/:id", wrap("Failed to update board", async (req, res) => {
  res.json(await tx((c) => board.updateBoard(c, req.user, req.params.id, req.body || {})));
}));

router.delete("/:id", wrap("Failed to archive board", async (req, res) => {
  await tx((c) => board.updateBoard(c, req.user, req.params.id, { is_archived: true }));
  res.json({ ok: true });
}));

router.post("/:id/members", wrap("Failed to add member", async (req, res) => {
  res.status(201).json(await tx((c) => board.addBoardMember(c, req.user, req.params.id, req.body || {})));
}));

router.delete("/:id/members/:memberId", wrap("Failed to remove member", async (req, res) => {
  await tx((c) => board.removeBoardMember(c, req.user, req.params.id, req.params.memberId));
  res.json({ ok: true });
}));

router.post("/:id/lists", wrap("Failed to create list", async (req, res) => {
  res.status(201).json(await tx((c) => board.createList(c, req.user, req.params.id, req.body || {})));
}));

router.post("/:id/lists/:listId/cards", wrap("Failed to create card", async (req, res) => {
  const created = await tx((c) =>
    board.createCard(c, req.user, req.params.id, {
      list_id: Number(req.params.listId),
      title: req.body?.title,
    })
  );
  res.status(201).json(created);
}));

router.post("/:id/labels", wrap("Failed to create label", async (req, res) => {
  await board.assertBoardEdit(pool, req.user, req.params.id);
  const { name, color } = req.body || {};
  if (!color) return res.status(400).json({ error: "A colour is required" });
  const { rows } = await pool.query(
    `INSERT INTO board_label (board_id, name, color) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, name || "", color]
  );
  res.status(201).json(rows[0]);
}));

router.post("/:id/statuses", wrap("Failed to create status", async (req, res) => {
  await board.assertBoardOwner(pool, req.user, req.params.id);
  const { name, color, category } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "A status name is required" });
  const { rows: last } = await pool.query(
    `SELECT "position" FROM board_status WHERE board_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [req.params.id]
  );
  const { rows } = await pool.query(
    `INSERT INTO board_status (board_id, name, color, category, "position")
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [
      req.params.id,
      name.trim(),
      color || "#78909C",
      ["TODO", "IN_PROGRESS", "DONE"].includes(category) ? category : "TODO",
      board.positionBetween(last[0]?.position ?? null, null),
    ]
  );
  res.status(201).json(rows[0]);
}));

router.post("/:id/custom-fields", wrap("Failed to create field", async (req, res) => {
  await board.assertBoardOwner(pool, req.user, req.params.id);
  const { name, type, options, show_on_front } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "A field name is required" });
  const { rows: last } = await pool.query(
    `SELECT "position" FROM board_custom_field WHERE board_id = $1 ORDER BY "position" DESC LIMIT 1`,
    [req.params.id]
  );
  const { rows } = await pool.query(
    `INSERT INTO board_custom_field (board_id, name, type, options, "position", show_on_front)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [
      req.params.id,
      name.trim(),
      ["TEXT", "NUMBER", "DATE", "CHECKBOX", "DROPDOWN"].includes(type) ? type : "TEXT",
      JSON.stringify(options || []),
      board.positionBetween(last[0]?.position ?? null, null),
      !!show_on_front,
    ]
  );
  res.status(201).json(rows[0]);
}));

router.get("/:id/views", wrap("Failed to fetch views", async (req, res) => {
  await board.assertBoardAccess(pool, req.user, req.params.id);
  const { rows } = await pool.query(
    `SELECT *, created_by AS created_by_id FROM board_view
     WHERE board_id = $1 AND (is_shared OR created_by = $2) ORDER BY "position"`,
    [req.params.id, req.user.id]
  );
  res.json(rows);
}));

router.post("/:id/views", wrap("Failed to save view", async (req, res) => {
  await board.assertBoardAccess(pool, req.user, req.params.id);
  const { name, view_type, filters, group_by, is_shared } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "A view name is required" });
  const { rows } = await pool.query(
    `INSERT INTO board_view (board_id, name, view_type, filters, group_by, is_shared, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *, created_by AS created_by_id`,
    [
      req.params.id,
      name.trim(),
      view_type || "board",
      JSON.stringify(filters || {}),
      group_by || null,
      !!is_shared,
      req.user.id,
    ]
  );
  res.status(201).json(rows[0]);
}));

router.get("/:id/capacity", wrap("Failed to fetch capacity", async (req, res) => {
  res.json(await board.getCapacity(pool, req.user, req.params.id));
}));

router.put("/:id/capacity/:memberId", wrap("Failed to set capacity", async (req, res) => {
  res.json(
    await tx((c) => board.setCapacity(c, req.user, req.params.id, req.params.memberId, req.body?.hours))
  );
}));

router.get("/:id/archive", wrap("Failed to fetch archive", async (req, res) => {
  res.json(await board.archivedItems(pool, req.user, req.params.id));
}));

router.get("/:id/forms", wrap("Failed to fetch forms", async (req, res) => {
  await board.assertBoardAccess(pool, req.user, req.params.id);
  const { rows } = await pool.query(`SELECT * FROM board_form WHERE board_id = $1 ORDER BY id`, [
    req.params.id,
  ]);
  res.json(rows);
}));

router.post("/:id/forms", wrap("Failed to create form", async (req, res) => {
  await board.assertBoardOwner(pool, req.user, req.params.id);
  const { list_id, slug, title, description, fields, is_public } = req.body || {};
  if (!list_id || !slug?.trim() || !title?.trim()) {
    return res.status(400).json({ error: "A list, slug and title are required" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO board_form (board_id, list_id, slug, title, description, fields, is_public, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        req.params.id,
        list_id,
        slug.trim(),
        title.trim(),
        description || null,
        JSON.stringify(fields || []),
        is_public !== false,
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That link name is already taken" });
    throw err;
  }
}));

router.delete("/forms/:formId", wrap("Failed to delete form", async (req, res) => {
  const { rows } = await pool.query(`SELECT board_id FROM board_form WHERE id = $1`, [
    req.params.formId,
  ]);
  if (!rows[0]) return res.status(404).json({ error: "Form not found" });
  await board.assertBoardOwner(pool, req.user, rows[0].board_id);
  await pool.query(`DELETE FROM board_form WHERE id = $1`, [req.params.formId]);
  res.json({ ok: true });
}));

module.exports = router;
