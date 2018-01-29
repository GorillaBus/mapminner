const log4js = require('log4js');

let Logger = (appSettings) => {

  /* Logging setup */
  log4js.configure({
    appenders: {
      out: { type: 'stdout' },
      app: { type: 'file', filename: appSettings.logging.file, maxLogSize: appSettings.logging.max_size, compress: appSettings.logging.compress, keepFileExt: true }
    },
    categories: {
      default: { appenders: [ 'out' ], level: 'debug' },
      app: { appenders: [ 'app' ], level: 'debug' },
      out: { appenders: [ 'out', 'app' ], level: 'debug' }
    }
  });

  let channel = appSettings.logging.stdout === true ? 'out':'app';
  let logger = log4js.getLogger(channel);
  let trace = (message) => { logger.trace(message); };
  let debug = (message) => { logger.debug(message); };
  let info = (message) => { logger.info(message); };
  let warn = (message) => { logger.warn(message); };
  let error = (message) => { logger.error(message); };
  let fatal = (message) => { logger.fatal(message); };

  let close = () => {
    log4js.shutdown();
  };

  return {
    trace: trace,
    debug: debug,
    info: info,
    warn: warn,
    error: error,
    fatal: fatal,
    close: close
  }
};

module.exports = Logger;
