import process from "process";
import path from "path";
import bodyParser from "body-parser";
import session from "express-session";
import express from "express";
import cookieParser from "cookie-parser";
import flash from 'connect-flash';
import sassMiddleware from "node-sass-middleware";
import tildeImporter from "node-sass-tilde-importer";
import uuidv4 from 'uuid/v4';

import { loggingMiddleware, sassLogger } from '../logger';
import createPassport from "./passport";
import addRoutes from "./routes";
import configureHandlebars from "./handlebars";
import { getParticipant } from "./handlers";
import { VetsAPIClient } from "../VetsAPIClient";

import promBundle from 'express-prom-bundle';
import * as Sentry from '@sentry/node';

function filterProperty(object, property) {
  if (property in object) {
    object[property] = '[Filtered]';
  }
}

export default function configureExpress(app, argv, idpOptions, spOptions, vetsAPIOptions) {
  const useSentry = argv.sentryDSN !== undefined && argv.sentryEnvironment !== undefined;
  if (useSentry) {
    Sentry.init({
      dsn: argv.sentryDSN,
      environment: argv.sentryEnvironment,
      beforeSend(event) {
        if (event.request) {
          filterProperty(event.request, 'cookies');
          filterProperty(event.request.headers, 'cookie');
          filterProperty(event.request.headers, 'authorization');

          let data;
          try {
            data = JSON.parse(event.request.data);
            filterProperty(data, 'SAMLResponse');
            filterProperty(data, 'SAMLRequest');
          } catch (err) {
            data = event.request.data;
          }

          event.request.data = data;
        }
        return event;
      },
      shouldHandleError(error) {
        // This is the default for Sentry (above 500s are sent to Sentry). I think there is a discussion to be had on what
        // errors we want to make it to Sentry. I could see us passing all errors through to Sentry, 4xx and 5xx
        if (error.status >= 400) {
          return true
        }
        return false
      }
    });
  }
  const [ passport, strategy ] = createPassport(spOptions);
  const hbs = configureHandlebars();
  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    customLabels: {app: 'saml_proxy'},
    normalizePath: [
      ['^/(img|fonts|~font-awesome)/.*', '/samlproxy/idp/#static'],
      ['^/samlproxy/idp/(img|fonts|~font-awesome)/.*', '/samlproxy/idp/#static']
    ]
  });
  app.set('port', process.env.PORT || argv.port);
  app.set('views', path.join(process.cwd(), './views'));
  // Express needs to know it is being ran behind a trusted proxy. Setting 'trust proxy' to true does a few things
  // but notably sets req.ip = 'X-Forwarded-for'. See http://expressjs.com/en/guide/behind-proxies.html
  app.set('trust proxy', true)

  /**
   * View Engine
   */

  app.set('view engine', 'hbs');
  app.set('view options', { layout: 'layout' });
  app.engine('handlebars', hbs.__express);
  if (useSentry) {
    app.use(Sentry.Handlers.requestHandler({
      user: false,
    }));
  }
  app.use(metricsMiddleware);
  app.use(passport.initialize());

  /**
   * Middleware
   */

  app.use(loggingMiddleware({
    skip: function (req, res)
    {
      return req.path.startsWith('/samlproxy/idp/bower_components') || req.path.startsWith('/samlproxy/idp/css');
    }
  }));
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(cookieParser());
  app.use(session({
    secret: argv.sessionSecret,
    resave: false,
    saveUninitialized: true,
    name: 'idp_sid',
    genid: uuidv4,
    cookie: { maxAge: 1000 * 60 * 5 }
  }));
  app.use(flash());

  app.use(sassMiddleware({
    src: path.join(process.cwd(), "styles"),
    dest: path.join(process.cwd(), "public"),
    debug: true,
    importer: tildeImporter,
    outputStyle: 'expanded',
    prefix: '/samlproxy/idp',
    log: (severity, key, value, message) => {
      sassLogger.log(severity, { key, value, message });
    },
  }));

  app.use('/samlproxy/idp', express.static(path.join(process.cwd(), 'public')));
  app.use('/fonts', express.static(path.join(process.cwd(), 'public/fonts')));

  app.use(function(req, res, next){
    req.metadata = idpOptions.profileMapper.metadata;
    req.passport = passport;
    req.strategy = strategy;
    req.vetsAPIClient = new VetsAPIClient(vetsAPIOptions.token, vetsAPIOptions.apiHost);
    req.sp = { options: spOptions };
    req.idp = { options: idpOptions };
    req.participant = getParticipant(req);
    next();
  });

  app.use(function(req, res, next){
    if (req.idp.options.rollSession) {
      req.session.regenerate(function(err) {
        return next();
      });
    } else {
      next();
    }
  });

  addRoutes(app, idpOptions, spOptions);

  if (useSentry) {
    app.use(Sentry.Handlers.errorHandler());
  }
  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    const err = new Error('Route Not Found');
    err.status = 404;
    next(err);
  });

  // development error handler
  app.use(function(err, req, res, next) {
    if (err) {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
    }
  });

  return app;
}


