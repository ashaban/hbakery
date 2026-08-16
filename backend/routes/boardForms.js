// routes/boardForms.js
//
// The public side of board intake forms: turning a request from someone
// with no login at all ("the mixer is making a noise") into a card on a
// board. Deliberately separate from routes/board.js (which requires a
// staff login) and mounted before jwtValidator in app.js, the same way
// the customer app's /geo and /customerAuth routes are — a login
// requirement here would defeat the entire point of a public form.

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { positionBetween } = require("../modules/board");

/** GET /boardForms/:slug — the form definition, for rendering the page. */
router.get("/:slug", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description, fields FROM board_form
       WHERE slug = $1 AND is_active AND is_public`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ error: "Form not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Fetch public form failed:", err);
    res.status(500).json({ error: "Failed to load form" });
  }
});

/**
 * POST /boardForms/:slug — submits the form, creating a card on the
 * form's board/list. The answers are folded into the card description
 * (matching ITSF-IMS's approach) rather than a separate answers table,
 * so nothing extra needs joining to read a card raised this way.
 */
router.post("/:slug", async (req, res) => {
  const { name, email, values } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: "Your name is required" });
  }

  const client = await pool.connect();
  try {
    const { rows: formRows } = await client.query(
      `SELECT * FROM board_form WHERE slug = $1 AND is_active AND is_public`,
      [req.params.slug]
    );
    const form = formRows[0];
    if (!form) return res.status(404).json({ error: "Form not found" });

    const fields = form.fields || [];
    for (const field of fields) {
      if (field.required && !String(values?.[field.key] || "").trim()) {
        return res.status(400).json({ error: `"${field.label}" is required` });
      }
    }

    const description = fields
      .map((field) => `**${field.label}**\n${values?.[field.key] ?? ""}`)
      .join("\n\n");

    await client.query("BEGIN");

    const { rows: last } = await client.query(
      `SELECT "position" FROM board_card WHERE list_id = $1 ORDER BY "position" DESC LIMIT 1`,
      [form.list_id]
    );
    const position = positionBetween(last[0]?.position ?? null, null);

    const { rows: firstStatus } = await client.query(
      `SELECT id FROM board_status WHERE board_id = $1 ORDER BY "position" LIMIT 1`,
      [form.board_id]
    );

    const { rows: card } = await client.query(
      `INSERT INTO board_card
         (board_id, list_id, status_id, title, description, "position",
          form_id, submitted_by_name, submitted_by_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        form.board_id,
        form.list_id,
        firstStatus[0]?.id || null,
        `${form.title}: ${name.trim()}`,
        description || null,
        position,
        form.id,
        name.trim(),
        email?.trim() || null,
      ]
    );

    await client.query(
      `INSERT INTO card_activity (card_id, board_id, user_id, action, summary)
       VALUES ($1,$2,NULL,'SUBMITTED',$3)`,
      [card[0].id, form.board_id, `Submitted via the "${form.title}" form by ${name.trim()}`]
    );

    await client.query("COMMIT");
    res.status(201).json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("❌ Public form submission failed:", err);
    res.status(500).json({ error: "Failed to submit form" });
  } finally {
    client.release();
  }
});

module.exports = router;
