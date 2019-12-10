const { createLogger, format, transports } = require("winston");

const logFormat = format.combine(
  format.timestamp({ alias: "time" }),
  format.json({
    space: 2,
    replacer: (key, value) => {
      // timestamp format's alias is in addition to "timestamp", this deduplicates the info object
      if (typeof value === "object" && key === "" && "timestamp" in value) {
        delete value["timestamp"];
      }

      return value;
    }
  })
);

const logger = createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'oauth-proxy' },
  transports: [
    new transports.Console({
      silent: process.env.NODE_ENV === 'test'
    }),
  ]
});

const middlewareLogFormat = (tokens, req, res) => {
  return JSON.stringify({
    'remote-address': tokens['remote-addr'](req, res),
    time: tokens.date(req, res, 'iso'),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    'status-code': tokens.status(req, res),
    'content-length': tokens.res(req, res, 'content-length'),
    referrer: tokens.referrer(req, res),
  }, null, 2);
};

module.exports = {
  logger,
  middlewareLogFormat,
};