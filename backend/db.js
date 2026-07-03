const config = require('./config');
const { Pool } = require('pg');

const pool = new Pool({
  user: config.get('postgres:username'),
  host: config.get('postgres:host'),
  database: config.get('postgres:database'),
  password: config.get('postgres:password'),
  port: config.get('postgres:port'),
});

// Idle clients can lose their connection to Postgres (network blip, DB
// restart) between requests. Without this listener, that error is unhandled
// and crashes the whole process instead of just letting the pool discard
// the dead client and create a fresh one on next use.
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;

