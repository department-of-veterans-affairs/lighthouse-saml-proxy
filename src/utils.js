import sass from "sass";
import tildeImporter from "node-sass-tilde-importer";
import fs from "fs";

export function getPath(path) {
  return path.startsWith("/") ? path : "/" + path;
}

export function getReqUrl(req, path) {
  if (req.get("host") === "localhost:7000") {
    return `http://${req.get("x-forwarded-host") || req.get("host")}${getPath(
      path || req.originalUrl
    )}`;
  } else {
    return `https://${req.get("x-forwarded-host") || req.get("host")}${getPath(
      path || req.originalUrl
    )}`;
  }
}

export function removeHeaders(cert) {
  const pem = /-----BEGIN (\w*)-----([^-]*)-----END (\w*)-----/g.exec(cert);
  if (pem && pem.length > 0) {
    return pem[2].replace(/[\n|\r\n]/g, "");
  }
  return cert;
}

export function logRelayState(req, logger, step) {
  const relayStateBody = req.body.RelayState;
  const relayStateQuery = req.query.RelayState;
  logger.info(
    `Relay state ${step} - body: ${relayStateBody} query: ${relayStateQuery}`,
    {
      time: new Date().toISOString(),
      relayStateBody,
      relayStateQuery,
      step: step,
      session: req.sessionID,
    }
  );
}

/*
 * Cache of previously rendered CSS files.
 */
let renderedCss = {};

/**
 * Middleware to render CSS from SCSS using dart-sass.
 *
 * Modeled after node-sass-middleware.
 *
 * @param {{src: string, dest: string}} options
 * @returns {Function}
 */
export function sassMiddleware(options) {
  const src = options.src;
  const dest = options.dest;

  return function middleware(req, res, next) {
    if (renderedCss[src]) {
      return next();
    }

    sass.render(
      {
        file: src,
        importer: tildeImporter,
        outputStyle: "expanded",
      },
      function (err, result) {
        if (err) {
          return next(err);
        }

        fs.writeFile(dest, result.css, "utf8", function (err) {
          if (err) {
            return next(err);
          }

          renderedCss[src] = result.stats.includedFiles;
          return next();
        });
      }
    );
  };
}
