const config = require('./config');
const { Pool } = require('pg');

const pool = new Pool({
  user: config.get('postgres:username'),
  host: config.get('postgres:host'),
  database: config.get('postgres:database'),
  password: config.get('postgres:password'),
  port: config.get('postgres:port'),
});

module.exports = pool;

