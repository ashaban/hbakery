const winston = require('winston');
const moment = require('moment');
require('winston-daily-rotate-file');
const fs = require('fs');
const path = require('path');
// /var/log requires root; fall back to a project-local, always-writable
// directory so a permissions mismatch here can't take the whole server
// down (this previously crashed the process on startup via an unhandled
// stream 'error' event from the log rotator).
const logDir = process.env.LOG_DIR || path.join(__dirname, 'logs');
try {
  fs.mkdirSync(logDir, { recursive: true });
} catch (err) {
  console.error(`Could not create log directory ${logDir}:`, err);
}
const logPrefix = 'IFAD-';
const maxLogFiles = 10;
const logDatePattern = 'YYYY-MM-DD-HH';
let transports = [ new winston.transports.Console() ];
if ( process.env.NODE_ENV !== "test" ) {
  let transport = new winston.transports.DailyRotateFile({
    dirname: logDir,
    filename: `${logPrefix}%DATE%.log`,
    datePattern: logDatePattern,
    zippedArchive: true,
    maxSize: '10m',
    maxFiles: '14d',
  });
  transport.on('rotate', () => {
    deleteOldLogs();
  });
  transport.on('new', () => {
    deleteOldLogs();
  });
  transport.on('archive', () => {
    deleteOldLogs();
  });
  transport.on('error', (err) => {
    console.error('Log file transport error (file logging disabled for this run):', err);
  });
  transports.push( transport );
}

const logger = winston.createLogger({
  transports: transports,
  format: winston.format.combine(
    winston.format.colorize({
      all: true,
    }),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.printf(
      info => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
});

function deleteOldLogs() {
  fs.readdir(logDir, (err, files) => {
    let logs = files.filter((file) => {
      return file.startsWith(logPrefix);
    });
    if(logs.length > maxLogFiles) {
      let keep = [];
      for(let file of logs) {
        if(keep.length < maxLogFiles) {
          keep.push(file);
          continue;
        }
        let removeKept = file.replace(logPrefix, '').split('.log')[0];
        let removeKeptIndex = -1;
        for(let index in keep) {
          let keptDate = keep[index].replace(logPrefix, '');
          keptDate = keep[index].split('.log')[0];
          if(moment(keptDate, logDatePattern) < moment(removeKept, logDatePattern)) {
            removeKept = keptDate;
            removeKeptIndex = index;
          }
        }
        if(removeKeptIndex !== -1) {
          keep.splice(removeKeptIndex, 1);
          keep.push(file);
        }
      }
      for(let file of logs) {
        let exist = keep.find((kp) => {
          return kp === file;
        });
        if(!exist) {
          try {
            fs.unlinkSync(`${logDir}/${file}`);
          } catch {
            continue;
          }
        }
      }
    }
  });
}
deleteOldLogs();
module.exports = logger;
