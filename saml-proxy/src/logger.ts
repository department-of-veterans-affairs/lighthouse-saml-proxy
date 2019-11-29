import morgan, { TokenIndexer, Options } from 'morgan';
import { format, createLogger, transports } from 'winston';
import { Request, Response } from 'express';

const logFormat = format.combine(
  format.timestamp(),
  format.json({ space: 2 })
);

const logger = createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'saml-proxy' },
  transports: [
    new transports.Console({
      // Keeps Winston logs out of Jest runs. console.log still works!
      silent: process.env.NODE_ENV === 'test'
    }),
  ]
});

const sassLogger = createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'saml-proxy', tag: 'sass' },
  transports: [new transports.Console()],
});

const middlewareJsonFormat = (tokens: TokenIndexer, req: Request, res: Response) => {
  return JSON.stringify({
    'remote-address': tokens['remote-addr'](req, res),
    timestamp: tokens.date(req, res, 'iso'),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    'status-code': tokens.status(req, res),
    'content-length': tokens.res(req, res, 'content-length'),
    referrer: tokens.referrer(req, res),
  });
};

const loggingMiddleware = (options: Options) => morgan(middlewareJsonFormat, options);

export {
  loggingMiddleware,
  sassLogger,
};

export default logger;
