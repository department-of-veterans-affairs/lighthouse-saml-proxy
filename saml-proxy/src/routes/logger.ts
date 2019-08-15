import morgan, { TokenIndexer, Options } from 'morgan';
import { format, createLogger, transports } from 'winston';
import { Request, Response } from 'express';

const logger = createLogger({
  level: 'info',
  format: format.json(),
  defaultMeta: { service: 'saml-proxy' },
  transports: [
    new transports.Console({
      // Keeps Winston logs out of Jest runs. console.log still works!
      silent: process.env.NODE_ENV === 'test'
    }),
  ]
});

const jsonFormat = (tokens: TokenIndexer, req: Request, res: Response) => (
  JSON.stringify({
    'remote-address': tokens['remote-addr'](req, res),
    time: tokens.date(req, res, 'iso'),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    'status-code': tokens.status(req, res),
    'content-length': tokens.res(req, res, 'content-length'),
    referrer: tokens.referrer(req, res),
  })
)

export const loggingMiddleware = (options: Options) => morgan(jsonFormat, options);

export default logger;
