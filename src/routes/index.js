import process from "process";
import path from "path";
import bodyParser from "body-parser";
import express from "express";
import flash from "connect-flash";
import { sassMiddleware, accessiblePhoneNumber } from "../utils";
import sass from "sass";
import tildeImporter from "node-sass-tilde-importer";
import rTracer from "cls-rtracer";
import { RedisCache } from "./types";
import {
  loggingMiddleware as morganMiddleware,
  winstonMiddleware,
  logger,
} from "../logger";
import addRoutes from "./routes";

import * as Sentry from "@sentry/node";

/**
 * This function filters the property object
 *
 * @param {*} object property
 * @param {*} property the object being filtered
 */
function filterProperty(object, property) {
  if (property in object) {
    object[property] = "[Filtered]";
  }
}

/**
 * Function for configure express
 *
 * @param {*} app param app
 * @param {*} argv argument vector for the sentry environment
 * @param {*} idpOptions user open id options
 * @param {*} spOptions user service provider options
 * @param {*} strategies map
 * @param {*} mpiUserClient client within the master patient index
 * @param {*} vsoClient used for connected with oauth
 * @param {*} cache redis cache
 * @param {*} cacheEnabled bool to check whether redis cache was enabled (set to true)
 * @returns {*} if sentry is undefined then it will return request data or it will return the app
 * which has params for error, request and respose messages.
 */
export default function configureExpress(
  app,
  argv,
  idpOptions,
  spOptions,
  strategies,
  mpiUserClient,
  vsoClient,
  cache = new RedisCache(),
  cacheEnabled = true
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

  app.set("port", process.env.PORT || argv.port);
  app.set("views", path.join(process.cwd(), "./views"));
  // Express needs to know it is being ran behind a trusted proxy. Setting 'trust proxy' to true does a few things
  // but notably sets req.ip = 'X-Forwarded-for'. See http://expressjs.com/en/guide/behind-proxies.html
  app.set("trust proxy", true);

  /**
   * View Engine
   */

  app.set("view engine", "ejs");
  // app.set("view options", { layout: "layout" });
  if (useSentry) {
    app.use(
      Sentry.Handlers.requestHandler({
        user: false,
      })
    );
  }

  /**
   * Middleware
   */
  app.use(rTracer.expressMiddleware());
  if (
    argv.logStyleElementsEnabled == null ||
    argv.logStyleElementsEnabled == true
  ) {
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
  }
  app.use(winstonMiddleware);
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(flash());

  app.use(
    sassMiddleware({
      src: path.join(process.cwd(), "styles", "core.scss"),
      dest: path.join(process.cwd(), "public", "core.css"),
      importer: tildeImporter,
      outputStyle: "expanded",
      sass: sass,
    })
  );

  // This route exposes our static assets - fonts, images, and css
  app.use("/samlproxy/idp", express.static(path.join(process.cwd(), "public")));

  app.use(function (req, res, next) {
    req.metadata = idpOptions.profileMapper.metadata;
    req.strategies = strategies;
    req.mpiUserClient = mpiUserClient;
    req.vsoClient = vsoClient;
    req.sps = { options: spOptions };
    req.idp = { options: idpOptions };
    req.requestAcsUrl = argv.spAcsUrl;
    next();
  });

  addRoutes(app, idpOptions, spOptions, argv.spAcsUrl, cache, cacheEnabled);

  // Catches errors
  app.use(function onError(err, req, res, next) {
    err.status = err.status || 500;
    logger.error("An error occured. ", err);
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
      const error_payload = {
        body: res.statusCode == 404 ? "error" : "sensitive_error",
        message: errMessage,
        request_id: rTracer.id(),
        wrapper_tags: accessiblePhoneNumber,
      };
      res.render("layout", error_payload);
    }
  });

  return app;
}
