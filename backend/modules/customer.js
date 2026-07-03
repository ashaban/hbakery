// Resolve a customer from either an existing id or a free-typed name,
// creating a new customer record on the fly when only a name is given.
// Shared by sales (single customer per sale) and customer debts
// (multiple named debtors per sale).
async function resolveCustomer(client, { customer_id, customer_name }) {
  if (customer_id) return customer_id;

  if (customer_name && customer_name.trim()) {
    const res = await client.query(
      `INSERT INTO customer (name, is_active)
       VALUES ($1, true)
       RETURNING id`,
      [customer_name.trim()]
    );
    return res.rows[0].id;
  }

  return null;
}

module.exports = { resolveCustomer };
