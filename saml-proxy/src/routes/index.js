import process from "process";
import path from "path";
import bodyParser from "body-parser";
import session from "express-session";
import express from "express";
import cookieParser from "cookie-parser";
import flash from "connect-flash";
import sassMiddleware from "node-sass-middleware";
import tildeImporter from "node-sass-tilde-importer";
import uuidv4 from "uuid/v4";
import rTracer from "cls-rtracer";

import {
  loggingMiddleware as morganMiddleware,
  winstonMiddleware,
  sassLogger,
  logger,
} from "../logger";
import createPassport from "./passport";
import addRoutes from "./routes";
import configureHandlebars from "./handlebars";
import { getParticipant } from "./handlers";

import promBundle from "express-prom-bundle";
import * as Sentry from "@sentry/node";

function filterProperty(object, property) {
  if (property in object) {
    object[property] = "[Filtered]";
  }
}

export default function configureExpress(
  app,
  argv,
  idpOptions,
  spOptions,
  vetsApiClient
) {
  const useSentry =
    argv.sentryDSN !== undefined && argv.sentryEnvironment !== undefined;
  if (useSentry) {
    Sentry.init({
      dsn: argv.sentryDSN,
      environment: argv.sentryEnvironment,
      beforeSend(event) {
        if (event.request) {
          filterProperty(event.request, "cookies");
          filterProperty(event.request.headers, "cookie");
          filterProperty(event.request.headers, "authorization");

          let data;
          try {
            data = JSON.parse(event.request.data);
            filterProperty(data, "SAMLResponse");
            filterProperty(data, "SAMLRequest");
          } catch (err) {
            data = event.request.data;
          }

          event.request.data = data;
        }
        return event;
      },
    });
  }
  const [passport, strategy] = createPassport(spOptions);
  const hbs = configureHandlebars();
  const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    customLabels: { app: "saml_proxy" },
    normalizePath: [
      ["^/(img|fonts|~font-awesome)/.*", "/samlproxy/idp/#static"],
      [
        "^/samlproxy/idp/(img|fonts|~font-awesome)/.*",
        "/samlproxy/idp/#static",
      ],
    ],
  });
  app.set("port", process.env.PORT || argv.port);
  app.set("views", path.join(process.cwd(), "./views"));
  // Express needs to know it is being ran behind a trusted proxy. Setting 'trust proxy' to true does a few things
  // but notably sets req.ip = 'X-Forwarded-for'. See http://expressjs.com/en/guide/behind-proxies.html
  app.set("trust proxy", true);

  /**
   * View Engine
   */

  app.set("view engine", "hbs");
  app.set("view options", { layout: "layout" });
  app.engine("handlebars", hbs.__express);
  if (useSentry) {
    app.use(
      Sentry.Handlers.requestHandler({
        user: false,
      })
    );
  }
  app.use(metricsMiddleware);
  app.use(passport.initialize());

  /**
   * Middleware
   */
  app.use(rTracer.expressMiddleware());
  app.use(
    morganMiddleware({
      skip: function (req, res) {
        return (
          req.path.startsWith("/samlproxy/idp/bower_components") ||
          req.path.startsWith("/samlproxy/idp/css")
        );
      },
    })
  );
  app.use(winstonMiddleware);
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(
    session({
      secret: argv.sessionSecret,
      resave: false,
      saveUninitialized: true,
      name: "idp_sid",
      genid: uuidv4,
      cookie: { maxAge: 1000 * 60 * 5 },
    })
  );
  app.use(flash());

  app.use(
    sassMiddleware({
      src: path.join(process.cwd(), "styles"),
      dest: path.join(process.cwd(), "public"),
      debug: true,
      importer: tildeImporter,
      outputStyle: "expanded",
      prefix: "/samlproxy/idp",
      log: (severity, key, value, message) => {
        sassLogger.log(severity, { key, value, message });
      },
    })
  );

  app.use("/samlproxy/idp", express.static(path.join(process.cwd(), "public")));
  app.use("/fonts", express.static(path.join(process.cwd(), "public/fonts")));

  app.use(function (req, res, next) {
    req.metadata = idpOptions.profileMapper.metadata;
    req.passport = passport;
    req.strategy = strategy;
    req.vetsAPIClient = vetsApiClient;
    req.sp = { options: spOptions };
    req.idp = { options: idpOptions };
    req.participant = getParticipant(req);
    next();
  });

  app.use(function (req, res, next) {
    if (req.idp.options.rollSession) {
      req.session.regenerate(function (err) {
        return next();
      });
    } else {
      next();
    }
  });

  addRoutes(app, idpOptions, spOptions);

  // Catches unhandled errors
  app.use(function onError(err, req, res, next) {
    err.status = err.status || 500;
    logger.error("An unhandled error occured. ", err);
    next(err);
  });

  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    const err = new Error("Route Not Found");
    err.status = 404;
    next(err);
  });

  if (useSentry) {
    app.use(
      Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          if (error.status >= 400) {
            logger.info("Error handled by sentry.");
            return true;
          }
          logger.info("Error not handled by sentry.");
          return false;
        },
      })
    );
  }

  app.use(function (err, req, res, next) {
    if (err) {
      res.status(err.status || 500);
      let errMessage =
        res.statusCode < 500 ? err.message : "Error processing SAML request";
      res.render("error", {
        message: errMessage,
      });
    }
  });

  return app;
}
