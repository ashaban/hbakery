/**
 * Record an entry in audit_log. Pass the same `client` the calling route
 * used for its own transaction so the audit entry commits or rolls back
 * together with the action it describes — an action that fails should
 * never leave behind a log entry saying it happened.
 */
async function recordAudit(
  client,
  { user, action, entity_type, entity_id = null, outlet_id = null, description, details = null }
) {
  await client.query(
    `INSERT INTO audit_log
      (user_id, user_name, action, entity_type, entity_id, outlet_id, description, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      user?.id || null,
      user?.name || null,
      action,
      entity_type,
      entity_id,
      outlet_id,
      description,
      details ? JSON.stringify(details) : null,
    ]
  );
}

module.exports = { recordAudit };
