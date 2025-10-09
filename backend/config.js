const nconf = require('nconf');
nconf.argv()
  .env()
  .file(`${__dirname}/config/config.json`)
module.exports = nconf;