// A bulk sale (car/shop trip) can record its own on-the-road costs right
// on the sale form. These are literally normal `expenditure` rows — same
// table, same cost_type categories the standalone Expenditures page uses
// — just tagged with sale_id so they can be shown/edited alongside the
// sale and folded into its cash-on-hand figure.

async function insertSaleExpenditures(client, saleId, saleDate, expenditures = []) {
  for (const e of expenditures) {
    if (!e.type_id) {
      const err = new Error("Each expenditure requires a cost type");
      err.code = "INVALID_EXPENDITURE";
      throw err;
    }
    if (!Number(e.amount) || Number(e.amount) <= 0) {
      const err = new Error("Each expenditure amount must be > 0");
      err.code = "INVALID_EXPENDITURE";
      throw err;
    }

    await client.query(
      `INSERT INTO expenditure (type_id, start_date, end_date, amount, description, sale_id)
       VALUES ($1,$2,$2,$3,$4,$5)`,
      [e.type_id, saleDate, e.amount, e.description || null, saleId]
    );
  }
}

async function deleteSaleExpenditures(client, saleId) {
  await client.query(`DELETE FROM expenditure WHERE sale_id = $1`, [saleId]);
}

async function getSaleExpenditures(client, saleId) {
  const { rows } = await client.query(
    `
    SELECT e.id, e.type_id, c.name AS type_name, c.category,
           e.amount, e.description, e.start_date
    FROM expenditure e
    JOIN cost_type c ON c.id = e.type_id
    WHERE e.sale_id = $1
    ORDER BY e.id
    `,
    [saleId]
  );
  return rows;
}

module.exports = {
  insertSaleExpenditures,
  deleteSaleExpenditures,
  getSaleExpenditures,
};
