import fs from "fs";
import logger from "./logger";
import { DOMParser } from "@xmldom/xmldom";
import { IConfiguredRequest } from "./routes/types";

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
    return sanitize(pem[2]);
  }
  return cert;
}

/**
 * This function logs the relay state
 *
 * @param {*} req The HTTP request
 * @param {*} logger logs information
 * @param {*} step relay state step
 */
export function logRelayState(req, logger, step) {
  const relayStateBody = sanitize(req.body.RelayState);
  const relayStateQuery = sanitize(req.query.RelayState);
  const relayStateStep = sanitize(step);
  const logMessage = `Relay state ${relayStateStep} - body: ${relayStateBody} query: ${relayStateQuery}`;
  logger.info(logMessage, {
    time: new Date().toISOString(),
    relayStateBody: relayStateBody,
    relayStateQuery: relayStateQuery,
    step: relayStateStep,
    session: getSamlId(req) || req.id,
  });
}

/**
 * This function sanitizes a message, by replacing new line escapes with ""
 *
 * @param {string} message message that needs to be sanitized
 * @returns {string} returns sanitized message
 */
export function sanitize(message) {
  if (message) {
    return message.replace(/\n|\r/g, "");
  } else {
    return "";
  }
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

/**
 * Gets the ID (InResponseTo) from SAMLRequest or SAMLResponse
 *
 * @param {IConfiguredRequest} req The HTTP request
 * @returns {*} a string if ID or InResponseTo is present
 */
export function getSamlId(req) {
  if (req?.authnRequest?.id) {
    return req?.authnRequest?.id;
  }
  if (req?.body?.SAMLResponse) {
    let id = getInResponseToFromSAML(req?.body?.SAMLResponse);
    if (id) return id;
  }
  if (req?.body?.SAMLRequest) {
    let id = getIdToFromSAML(req?.body?.SAMLRequest);
    if (id) return id;
  }
  logger.error("SAML ID not found");
}

/**
 * Retrieves InResponseTo assertion from SAMLResponse
 *
 * @param {string} samlResponse the raw samlResponse
 * @returns {*} a string if InResponseTo is present
 */
function getInResponseToFromSAML(samlResponse) {
  try {
    const decoded = Buffer.from(samlResponse, "base64").toString("ascii");
    const parser = new DOMParser();
    return parser
      .parseFromString(decoded)
      ?.documentElement?.getAttributeNode("InResponseTo")?.nodeValue;
  } catch (err) {
    logger.error("getInResponseToFromSAML failed: ", err);
  }
}

/**
 * Retrieves ID assertion from SAMLRequest
 *
 * @param {string} samlRequest the raw samlRequest
 * @returns {*} a string if ID is present
 */
function getIdToFromSAML(samlRequest) {
  try {
    const decoded = Buffer.from(samlRequest, "base64").toString("ascii");
    const parser = new DOMParser();
    return parser
      .parseFromString(decoded)
      ?.documentElement?.getAttributeNode("ID")?.nodeValue;
  } catch (err) {
    logger.error("getIdToFromSAML failed: ", err);
  }
}

/**
 * Retrieves RelayState from Request
 *
 * @param {IConfiguredRequest} req the raw request
 * @returns {*} a string if state is present
 */
export function getRelayState(req) {
  if (req?.authnRequest?.RelayState) {
    return req?.authnRequest?.RelayState;
  }
  if (req?.query?.RelayState) {
    return req?.query?.RelayState;
  }
  if (req?.body?.RelayState) {
    return req?.body?.RelayState;
  }
  logger.error("RelayState not found");
}
