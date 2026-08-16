// routes/board.js
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
        : err.code === "TIMER_RUNNING" || err.code === "LAST_OWNER" || err.code === "CYCLE"
        ? 409
        : 400;
    return res.status(status).json({ error: err.message });
  }
  console.error(`❌ ${fallback}:`, err);
  return res.status(500).json({ error: fallback });
}

async function withTransaction(fn) {
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

// Every board route needs a signed-in staff-mapped user; can_use_boards is
// granted to every role by the migration, so this is really just "signed in".
router.use(requireTask("can_use_boards"));

// People-picker for assigning/mentioning — deliberately not gated by
// can_see_users, same reasoning as the customer picker on Sales: adding
// someone to a card needs their name, regardless of whether the current
// user manages user accounts.
router.get("/users", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, name FROM users ORDER BY name`);
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch users");
  }
});

// ── Boards ────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    res.json({ data: await board.listBoards(pool, req.user) });
  } catch (err) {
    handleError(res, err, "Failed to fetch boards");
  }
});

router.post("/", async (req, res) => {
  try {
    const created = await withTransaction((client) => board.createBoard(client, req.user, req.body || {}));
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err, "Failed to create board");
  }
});

router.get("/search", async (req, res) => {
  const term = (req.query.q || "").trim();
  if (!term) return res.json({ data: [] });
  try {
    res.json({ data: await board.searchCards(pool, req.user, term) });
  } catch (err) {
    handleError(res, err, "Search failed");
  }
});

router.get("/:id", async (req, res) => {
  try {
    res.json(await board.getBoard(pool, req.user, req.params.id));
  } catch (err) {
    handleError(res, err, "Failed to fetch board");
  }
});

router.put("/:id", async (req, res) => {
  try {
    res.json(await withTransaction((client) => board.updateBoard(client, req.user, req.params.id, req.body || {})));
  } catch (err) {
    handleError(res, err, "Failed to update board");
  }
});

router.post("/:id/members", async (req, res) => {
  try {
    res.status(201).json(
      await withTransaction((client) => board.addBoardMember(client, req.user, req.params.id, req.body || {}))
    );
  } catch (err) {
    handleError(res, err, "Failed to add member");
  }
});

router.delete("/:id/members/:staffId", async (req, res) => {
  try {
    await withTransaction((client) => board.removeBoardMember(client, req.user, req.params.id, req.params.staffId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to remove member");
  }
});

// ── Lists ─────────────────────────────────────────────────────────

router.post("/:id/lists", async (req, res) => {
  try {
    res.status(201).json(
      await withTransaction((client) => board.createList(client, req.user, req.params.id, req.body || {}))
    );
  } catch (err) {
    handleError(res, err, "Failed to create list");
  }
});

router.put("/lists/:listId/move", async (req, res) => {
  try {
    await withTransaction((client) => board.moveList(client, req.user, req.params.listId, req.body || {}));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to move list");
  }
});

router.post("/lists/:listId/archive", async (req, res) => {
  try {
    await withTransaction((client) => board.archiveList(client, req.user, req.params.listId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to archive list");
  }
});

// ── Labels / statuses / custom fields (simple owned sub-resources) ──

router.post("/:id/labels", async (req, res) => {
  try {
    await board.assertBoardEdit(pool, req.user, req.params.id);
    const { name, color } = req.body || {};
    if (!color) return res.status(400).json({ error: "A color is required" });
    const { rows } = await pool.query(
      `INSERT INTO board_label (board_id, name, color) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, name || "", color]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, "Failed to create label");
  }
});

router.delete("/labels/:labelId", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT board_id FROM board_label WHERE id = $1`, [req.params.labelId]);
    if (!rows[0]) return res.status(404).json({ error: "Label not found" });
    await board.assertBoardEdit(pool, req.user, rows[0].board_id);
    await pool.query(`DELETE FROM board_label WHERE id = $1`, [req.params.labelId]);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete label");
  }
});

router.post("/:id/statuses", async (req, res) => {
  try {
    await board.assertBoardEdit(pool, req.user, req.params.id);
    const { name, color, category } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "A status name is required" });
    const { rows: last } = await pool.query(
      `SELECT "position" FROM board_status WHERE board_id = $1 ORDER BY "position" DESC LIMIT 1`,
      [req.params.id]
    );
    const position = board.positionBetween(last[0]?.position ?? null, null);
    const { rows } = await pool.query(
      `INSERT INTO board_status (board_id, name, color, category, "position") VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, name.trim(), color || "#78909C", ["TODO", "IN_PROGRESS", "DONE"].includes(category) ? category : "TODO", position]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, "Failed to create status");
  }
});

router.delete("/statuses/:statusId", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT board_id FROM board_status WHERE id = $1`, [req.params.statusId]);
    if (!rows[0]) return res.status(404).json({ error: "Status not found" });
    await board.assertBoardEdit(pool, req.user, rows[0].board_id);
    await pool.query(`DELETE FROM board_status WHERE id = $1`, [req.params.statusId]);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete status");
  }
});

router.post("/:id/custom-fields", async (req, res) => {
  try {
    await board.assertBoardEdit(pool, req.user, req.params.id);
    const { name, type, options } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "A field name is required" });
    const { rows: last } = await pool.query(
      `SELECT "position" FROM board_custom_field WHERE board_id = $1 ORDER BY "position" DESC LIMIT 1`,
      [req.params.id]
    );
    const position = board.positionBetween(last[0]?.position ?? null, null);
    const { rows } = await pool.query(
      `INSERT INTO board_custom_field (board_id, name, type, options, "position") VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, name.trim(), ["TEXT", "NUMBER", "DATE", "CHECKBOX", "DROPDOWN"].includes(type) ? type : "TEXT", JSON.stringify(options || []), position]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, "Failed to create custom field");
  }
});

router.put("/cards/:cardId/custom-values/:fieldId", async (req, res) => {
  try {
    const { rows: cardRow } = await pool.query(`SELECT board_id FROM board_card WHERE id = $1`, [
      req.params.cardId,
    ]);
    if (!cardRow[0]) return res.status(404).json({ error: "Card not found" });
    await board.assertBoardEdit(pool, req.user, cardRow[0].board_id);
    await pool.query(
      `INSERT INTO card_custom_value (card_id, field_id, value) VALUES ($1,$2,$3)
       ON CONFLICT (card_id, field_id) DO UPDATE SET value = EXCLUDED.value`,
      [req.params.cardId, req.params.fieldId, JSON.stringify(req.body?.value ?? null)]
    );
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to set custom field value");
  }
});

// ── Saved views ───────────────────────────────────────────────────

router.get("/:id/views", async (req, res) => {
  try {
    await board.assertBoardAccess(pool, req.user, req.params.id);
    const { rows } = await pool.query(
      `SELECT * FROM board_view WHERE board_id = $1 AND (is_shared OR created_by = $2) ORDER BY "position"`,
      [req.params.id, req.user.id]
    );
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch views");
  }
});

router.post("/:id/views", async (req, res) => {
  try {
    await board.assertBoardAccess(pool, req.user, req.params.id);
    const { name, view_type, filters, group_by, is_shared } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "A view name is required" });
    const { rows } = await pool.query(
      `INSERT INTO board_view (board_id, name, view_type, filters, group_by, is_shared, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, name.trim(), view_type || "kanban", JSON.stringify(filters || {}), group_by || null, !!is_shared, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, "Failed to save view");
  }
});

router.delete("/views/:viewId", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM board_view WHERE id = $1`, [req.params.viewId]);
    if (!rows[0]) return res.status(404).json({ error: "View not found" });
    if (rows[0].created_by !== req.user.id) {
      await board.assertBoardOwner(pool, req.user, rows[0].board_id);
    }
    await pool.query(`DELETE FROM board_view WHERE id = $1`, [req.params.viewId]);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete view");
  }
});

// ── Cards ─────────────────────────────────────────────────────────

router.get("/:id/cards", async (req, res) => {
  try {
    res.json({ data: await board.listCards(pool, req.user, req.params.id) });
  } catch (err) {
    handleError(res, err, "Failed to fetch cards");
  }
});

router.post("/:id/cards", async (req, res) => {
  try {
    const created = await withTransaction((client) => board.createCard(client, req.user, req.params.id, req.body || {}));
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err, "Failed to create card");
  }
});

router.get("/cards/:cardId", async (req, res) => {
  try {
    res.json(await board.getCard(pool, req.user, req.params.cardId));
  } catch (err) {
    handleError(res, err, "Failed to fetch card");
  }
});

router.put("/cards/:cardId", async (req, res) => {
  try {
    res.json(await withTransaction((client) => board.updateCard(client, req.user, req.params.cardId, req.body || {})));
  } catch (err) {
    handleError(res, err, "Failed to update card");
  }
});

router.put("/cards/:cardId/move", async (req, res) => {
  try {
    res.json(await withTransaction((client) => board.moveCard(client, req.user, req.params.cardId, req.body || {})));
  } catch (err) {
    handleError(res, err, "Failed to move card");
  }
});

router.post("/cards/:cardId/archive", async (req, res) => {
  try {
    await withTransaction((client) => board.archiveCard(client, req.user, req.params.cardId, req.body?.archived !== false));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to archive card");
  }
});

router.delete("/cards/:cardId", async (req, res) => {
  try {
    await withTransaction((client) => board.deleteCard(client, req.user, req.params.cardId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete card");
  }
});

router.put("/cards/:cardId/members", async (req, res) => {
  try {
    await withTransaction((client) => board.setCardMembers(client, req.user, req.params.cardId, req.body?.user_ids || []));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to set assignees");
  }
});

router.put("/cards/:cardId/labels", async (req, res) => {
  try {
    await withTransaction((client) => board.setCardLabels(client, req.user, req.params.cardId, req.body?.label_ids || []));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to set labels");
  }
});

router.put("/cards/:cardId/tags", async (req, res) => {
  try {
    await withTransaction((client) => board.setCardTags(client, req.user, req.params.cardId, req.body?.tags || []));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to set tags");
  }
});

router.get("/tags", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM tag ORDER BY name`);
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch tags");
  }
});

// ── Subtasks & dependencies ──────────────────────────────────────────

router.post("/cards/:cardId/subtasks", async (req, res) => {
  try {
    const child = await withTransaction((client) => board.addSubtask(client, req.user, req.params.cardId, req.body?.title));
    res.status(201).json(child);
  } catch (err) {
    handleError(res, err, "Failed to add subtask");
  }
});

router.post("/cards/:cardId/dependencies", async (req, res) => {
  try {
    await withTransaction((client) => board.addDependency(client, req.user, req.params.cardId, req.body?.blocker_card_id));
    res.status(201).json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to add dependency");
  }
});

router.delete("/cards/:cardId/dependencies/:blockerId", async (req, res) => {
  try {
    await withTransaction((client) => board.removeDependency(client, req.user, req.params.cardId, req.params.blockerId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to remove dependency");
  }
});

// ── Checklists ────────────────────────────────────────────────────

router.post("/cards/:cardId/checklists", async (req, res) => {
  try {
    res.status(201).json(await withTransaction((client) => board.addChecklist(client, req.user, req.params.cardId, req.body?.name)));
  } catch (err) {
    handleError(res, err, "Failed to add checklist");
  }
});

router.post("/checklists/:checklistId/items", async (req, res) => {
  try {
    res.status(201).json(
      await withTransaction((client) => board.addChecklistItem(client, req.user, req.params.checklistId, req.body || {}))
    );
  } catch (err) {
    handleError(res, err, "Failed to add checklist item");
  }
});

router.put("/checklist-items/:itemId", async (req, res) => {
  try {
    await withTransaction((client) => board.toggleChecklistItem(client, req.user, req.params.itemId, req.body?.is_done !== false));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to update checklist item");
  }
});

router.delete("/checklist-items/:itemId", async (req, res) => {
  try {
    await withTransaction((client) => board.deleteChecklistItem(client, req.user, req.params.itemId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete checklist item");
  }
});

// ── Comments ──────────────────────────────────────────────────────

router.post("/cards/:cardId/comments", async (req, res) => {
  try {
    res.status(201).json(
      await withTransaction((client) => board.addComment(client, req.user, req.params.cardId, req.body || {}))
    );
  } catch (err) {
    handleError(res, err, "Failed to add comment");
  }
});

router.post("/comments/:commentId/resolve", async (req, res) => {
  try {
    await withTransaction((client) => board.resolveComment(client, req.user, req.params.commentId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to resolve comment");
  }
});

// ── Links ─────────────────────────────────────────────────────────

router.post("/cards/:cardId/links", async (req, res) => {
  try {
    res.status(201).json(await withTransaction((client) => board.addLink(client, req.user, req.params.cardId, req.body || {})));
  } catch (err) {
    handleError(res, err, "Failed to add link");
  }
});

router.delete("/links/:linkId", async (req, res) => {
  try {
    await withTransaction((client) => board.deleteLink(client, req.user, req.params.linkId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete link");
  }
});

// ── Time tracking ─────────────────────────────────────────────────

router.post("/cards/:cardId/timer/start", async (req, res) => {
  try {
    res.status(201).json(await withTransaction((client) => board.startTimer(client, req.user, req.params.cardId)));
  } catch (err) {
    handleError(res, err, "Failed to start timer");
  }
});

router.post("/time-entries/:entryId/stop", async (req, res) => {
  try {
    res.json(await withTransaction((client) => board.stopTimer(client, req.user, req.params.entryId)));
  } catch (err) {
    handleError(res, err, "Failed to stop timer");
  }
});

router.post("/cards/:cardId/time-entries", async (req, res) => {
  try {
    res.status(201).json(
      await withTransaction((client) => board.addManualTimeEntry(client, req.user, req.params.cardId, req.body || {}))
    );
  } catch (err) {
    handleError(res, err, "Failed to add time entry");
  }
});

router.get("/time-entries/running", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, c.title AS card_title, c.board_id
       FROM card_time_entry t JOIN board_card c ON c.id = t.card_id
       WHERE t.user_id = $1 AND t.ended_at IS NULL`,
      [req.user.id]
    );
    res.json({ data: rows[0] || null });
  } catch (err) {
    handleError(res, err, "Failed to check running timer");
  }
});

// ── Recurrence ────────────────────────────────────────────────────

router.put("/cards/:cardId/recurrence", async (req, res) => {
  try {
    res.json(await withTransaction((client) => board.setRecurrence(client, req.user, req.params.cardId, req.body || {})));
  } catch (err) {
    handleError(res, err, "Failed to set recurrence");
  }
});

router.delete("/cards/:cardId/recurrence", async (req, res) => {
  try {
    await withTransaction((client) => board.clearRecurrence(client, req.user, req.params.cardId));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to clear recurrence");
  }
});

// ── Workload / time reports (aggregations over cards the user can see) ──

router.get("/:id/workload", async (req, res) => {
  try {
    await board.assertBoardAccess(pool, req.user, req.params.id);
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.name AS user_name,
              COUNT(c.id)::int AS card_count,
              COALESCE(SUM(c.estimate_minutes), 0)::int AS estimate_minutes,
              COUNT(c.id) FILTER (WHERE c.due_at IS NOT NULL AND c.due_at < NOW() AND NOT c.due_complete)::int AS overdue_count
       FROM card_member cm
       JOIN users u ON u.id = cm.user_id
       JOIN board_card c ON c.id = cm.card_id AND c.board_id = $1 AND NOT c.is_archived
       GROUP BY u.id, u.name ORDER BY u.name`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch workload");
  }
});

router.get("/:id/time-report", async (req, res) => {
  try {
    await board.assertBoardAccess(pool, req.user, req.params.id);
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.name AS user_name, c.id AS card_id, c.title AS card_title,
              COALESCE(SUM(t.minutes), 0)::int AS minutes
       FROM card_time_entry t
       JOIN users u ON u.id = t.user_id
       JOIN board_card c ON c.id = t.card_id
       WHERE c.board_id = $1 AND t.minutes IS NOT NULL
       GROUP BY u.id, u.name, c.id, c.title ORDER BY u.name, minutes DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch time report");
  }
});

// ── Intake forms ──────────────────────────────────────────────────

router.post("/:id/forms", async (req, res) => {
  try {
    await board.assertBoardOwner(pool, req.user, req.params.id);
    const { list_id, slug, title, description, fields, is_public } = req.body || {};
    if (!list_id || !slug?.trim() || !title?.trim()) {
      return res.status(400).json({ error: "A list, slug and title are required" });
    }
    const { rows } = await pool.query(
      `INSERT INTO board_form (board_id, list_id, slug, title, description, fields, is_public, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, list_id, slug.trim(), title.trim(), description || null, JSON.stringify(fields || []), !!is_public, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That slug is already taken" });
    handleError(res, err, "Failed to create form");
  }
});

router.get("/:id/forms", async (req, res) => {
  try {
    await board.assertBoardAccess(pool, req.user, req.params.id);
    const { rows } = await pool.query(`SELECT * FROM board_form WHERE board_id = $1 ORDER BY id`, [req.params.id]);
    res.json({ data: rows });
  } catch (err) {
    handleError(res, err, "Failed to fetch forms");
  }
});

router.delete("/forms/:formId", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT board_id FROM board_form WHERE id = $1`, [req.params.formId]);
    if (!rows[0]) return res.status(404).json({ error: "Form not found" });
    await board.assertBoardOwner(pool, req.user, rows[0].board_id);
    await pool.query(`DELETE FROM board_form WHERE id = $1`, [req.params.formId]);
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete form");
  }
});

module.exports = router;

// ── Public intake submission (mounted separately, no auth) ─────────
// See routes/boardForms.js.
