const { createLogger, format, transports } = require("winston");

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json({ space: 2 })
  ),
  defaultMeta: { service: 'oauth-proxy' },
  transports: [
    new transports.Console({
      silent: process.env.NODE_ENV === 'test'
    }),
  ]
});

module.exports = logger;