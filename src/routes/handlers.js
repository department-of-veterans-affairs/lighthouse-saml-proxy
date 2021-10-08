import { getPath, getReqUrl, logRelayState } from "../utils";
import samlp from "samlp";
import { SAML, samlp as _samlp } from "passport-wsfed-saml2";
import {
  buildPassportLoginHandler,
  testLevelOfAssuranceOrRedirect,
  validateIdpResponse,
  loadICN,
  scrubUserClaims,
  serializeAssertions,
  urlUserErrorTemplate,
} from "./acsHandlers";
import logger from "../logger";
import rTracer from "cls-rtracer";

export const getHashCode = (str) => {
  var hash = 0;
  var i = 0;
  if (str.length == 0) return hash;
  for (i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

export const samlLogin = function (template) {
  return function (req, res, next) {
    const acsUrl = req.query.acsUrl
      ? getReqUrl(req, req.query.acsUrl)
      : getReqUrl(req, req.sp.options.requestAcsUrl);
    const authnRequest = req.authnRequest
      ? req.authnRequest
      : req.session
      ? req.session.authnRequest
      : null;
    let relayState;
    if (!authnRequest) {
      logger.warn("There is no authnRequest in the request or session");
      relayState = req.query?.RelayState || req.body?.RelayState;
    } else {
      relayState = authnRequest.relayState
        ? authnRequest.relayState
        : req.query?.RelayState;
    }
    if (relayState == null || relayState == "") {
      let logMessage =
        template === "verify"
          ? "Empty relay state during verify. Invalid request."
          : "Empty relay state. Invalid request.";
      logger.error(logMessage);
      throw {
        message: "Error: " + logMessage,
        status: 400,
      };
    }
    const samlp = new _samlp(
      req.sp.options.getResponseParams(),
      new SAML.SAML(req.sp.options.getResponseParams())
    );

    let login_gov_enabled;
    if (req.sp.options.otherLogins?.login_gov) {
      login_gov_enabled = true;
    } else {
      login_gov_enabled = false;
    }
    const authnSelection = [
      ["id_me_login_link", req.sp.options.idpLoginLink],
      ["dslogon_login_link", "dslogon"],
      ["mhv_login_link", "myhealthevet"],
      [
        "id_me_signup_link",
        "http://idmanagement.gov/ns/assurance/loa/3",
        "&op=signup",
      ],
    ];
    if (login_gov_enabled) {
      authnSelection.push([
        "login_gov_login_link",
        req.sp.options.idpLoginLink,
      ]);
    }

    authnSelection
      .reduce((memo, [key, authnContext, exParams = null]) => {
        const params = req.sp.options.getAuthnRequestParams(
          acsUrl,
          (authnRequest && authnRequest.forceAuthn) || "false",
          relayState || "/",
          authnContext,
          rTracer.id()
        );
        return memo.then((m) => {
          return new Promise((resolve, reject) => {
            samlp.getSamlRequestUrl(params, (err, url) => {
              if (err) {
                reject(err);
              }

              if (exParams) {
                m[key] = url + exParams;
              } else {
                m[key] = url;
              }
              resolve(m);
            });
          });
        });
      }, Promise.resolve({}))
      .then((authOptions) => {
        authOptions.login_gov_enabled = login_gov_enabled;
        res.render(template, authOptions);
        logger.info("User arrived from Okta. Rendering IDP login template.", {
          action: "parseSamlRequest",
          result: "success",
          session: req.sessionID,
        });
      })
      .catch(next);
  };
};

/**
 * Shared Handlers
 */

export const parseSamlRequest = function (req, res, next) {
  logRelayState(req, logger, "from Okta");
  if (!req.session) {
    logger.warn("session is null or undefined parsing the SAML request");
  }
  samlp.parseRequest(req, function (err, data) {
    if (err) {
      logger.warn("Allowing login with no final redirect.");
      next();
    }
    if (data) {
      req.authnRequest = {
        relayState: req.query.RelayState || req.body.RelayState,
        id: data.id,
        issuer: data.issuer,
        destination: data.destination,
        acsUrl: data.assertionConsumerServiceURL,
        forceAuthn: data.forceAuthn === "true",
      };
      req.session.authnRequest = req.authnRequest;
    }
    next();
  });
};

export const getSessionIndex = (req) => {
  if (req && req.session) {
    return Math.abs(getHashCode(req.session.id)).toString();
  }
  return 0;
};

export const getParticipant = (req) => {
  const participant = {
    serviceProviderId: req.idp.options.serviceProviderId,
    sessionIndex: getSessionIndex(req),
    serviceProviderLogoutURL: req.idp.options.sloUrl,
  };
  if (req.user) {
    participant.nameId = req.user.userName;
    participant.nameIdFormat = req.user.nameIdFormat;
  }
  return participant;
};

const processAcs = (acsUrl, cache, cacheEnabled) => [
  buildPassportLoginHandler(acsUrl),
  testLevelOfAssuranceOrRedirect,
  validateIdpResponse(cache, cacheEnabled),
  loadICN,
  scrubUserClaims,
  serializeAssertions,
];

export const acsFactory = (app, acsUrl, cache, cacheEnabled) => {
  app.get(getPath(acsUrl), processAcs(acsUrl, cache, cacheEnabled));
  app.post(getPath(acsUrl), processAcs(acsUrl, cache, cacheEnabled));
};

export const handleError = (req, res) => {
  logger.error({ idp_sid: req.cookies.idp_sid });
  res.render(urlUserErrorTemplate(req), { request_id: rTracer.id() });
};
