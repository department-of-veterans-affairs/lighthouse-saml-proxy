import fs from "fs";

/**
 * This function gets the path
 *
 * @param {*} path string path
 * @returns {*} returns the string path
 */
export function getPath(path) {
  return path.startsWith("/") ? path : "/" + path;
}
/**
 * This function creates a check to see if host is equal to localhost then
 * returns a req url accordingly
 *
 * @param {*} req The HTTP request
 * @param {*} path the HTTP url path
 * @returns {*} returns a http or https path depending on the check
 */
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
/**
 * Creates a check to remove headers with BEGIN and END message
 *
 * @param {*} cert the param for certificate
 * @returns {*} returns the cert pem
 */
export function removeHeaders(cert) {
  const pem = /-----BEGIN (\w*)-----([^-]*)-----END (\w*)-----/g.exec(cert);
  if (pem && pem.length > 0) {
    return pem[2].replace(/[\n|\r\n]/g, "");
  }
  return cert;
}
/**
 * This function logs the relay state using relay state
 *
 * @param {*} req The HTTP request
 * @param {*} logger logs information
 * @param {*} step relay state step
 */
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

/**
 * This function gets an accessible phone number using the digitString
 * param and unshifts digits accordingly
 *
 * @param {*} digitString the string fir phone number
 * @returns {*} returns the telephone number with the label
 */
export function accessiblePhoneNumber(digitString) {
  var digits = digitString.split("").filter(function (ch) {
    return "0123456789".indexOf(ch) !== -1;
  });
  var justDigitsString = digits.join("");

  var ariaLabelParts = [];
  var consumeDigits = function (segLen) {
    if (digits.length == 0) {
      // no-op
    } else if (digits.length >= segLen) {
      ariaLabelParts.unshift(".");
      for (var idx = 0; idx < segLen; idx++) {
        ariaLabelParts.unshift(digits.pop());
        ariaLabelParts.unshift(" ");
      }
    } else {
      ariaLabelParts.unshift(".");
      while (digits.length > 0) {
        ariaLabelParts.unshift(digits.pop());
        ariaLabelParts.unshift(" ");
      }
    }
  };

  consumeDigits(4);
  consumeDigits(3);
  consumeDigits(3);
  consumeDigits(999);

  var ariaLabelString = ariaLabelParts.join("");
  return `<a href="tel:${justDigitsString}" aria-label="${ariaLabelString}">${digitString}</a>`;
}

/*
 * Cache of previously rendered CSS files.
 */
let renderedCss = {};

/**
 * Middleware to lazily-render CSS from SCSS.
 *
 * Modeled after node-sass-middleware.
 *
 * @param {*} options parameter object for options
 *     src: string,
 *     dest: string,
 *     importer: Function,
 *     outputStyle: String,
 *     sass: Function, log: Function
 * @returns {Function} next() function within sass middleware
 */
export function sassMiddleware(options) {
  const src = options.src;
  const dest = options.dest;
  const importer = options.importer;
  const outputStyle = options.outputStyle;
  const sass = options.sass;
  const log = options.log || function () {};

  return function middleware(req, res, next) {
    if (!/\.css$/.test(req.path)) {
      log("skipping non-css path");
      return next();
    }

    if (renderedCss[src]) {
      log("css already rendered");
      return next();
    }

    try {
      log("rendering css");
      const result = sass.renderSync({
        file: src,
        importer: importer,
        outputStyle: outputStyle,
      });

      log("writing to file");
      fs.writeFileSync(dest, result.css, "utf8");

      log("caching src");
      renderedCss[src] = result.stats.includedFiles;
    } catch (err) {
      next(err);
    }

    return next();
  };
}
