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
      : getReqUrl(req, req.requestAcsUrl);
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
    const samlp = {};
    Object.keys(req.sps.options).forEach((idpKey) => {
      samlp[idpKey] = new _samlp(
        req.sps.options[idpKey].getResponseParams(),
        new SAML.SAML(req.sps.options[idpKey].getResponseParams())
      );
    });

    const authnSelection = [
      ["id_me_login_link", "http://idmanagement.gov/ns/assurance/loa/3"],
      ["dslogon_login_link", "dslogon"],
      ["mhv_login_link", "myhealthevet"],
      [
        "id_me_signup_link",
        "http://idmanagement.gov/ns/assurance/loa/3",
        "&op=signup",
      ],
    ];
    const idpsEnabled = [];
    Object.values(req.sps.options).forEach((spConfig) => {
      if (spConfig.category != "id_me") {
        authnSelection.push([
          spConfig.category + "_login_link",
          spConfig.assurance,
        ]);
        const enabledIdp = {};
        idpsEnabled.push(enabledIdp);
        enabledIdp.category = spConfig.category;
        if (spConfig.signupLink) {
          enabledIdp.signupLink = spConfig.signupLink;
        }
      }
    });

    authnSelection
      .reduce((memo, [key, authnContext, exParams = null]) => {
        let idpKey = "id_me";
        if (
          key.startsWith("id_me") ||
          key === "dslogon_login_link" ||
          key === "mhv_login_link"
        ) {
          idpKey = "id_me";
        } else {
          idpKey = key.substring(0, key.lastIndexOf("_login_link"));
        }
        const params = req.sps.options[idpKey].getAuthnRequestParams(
          acsUrl,
          (authnRequest && authnRequest.forceAuthn) || "false",
          relayState || "/",
          authnContext,
          rTracer.id()
        );
        return memo.then((m) => {
          return new Promise((resolve, reject) => {
            samlp[idpKey].getSamlRequestUrl(params, (err, url) => {
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
        idpsEnabled.forEach((enabledIdp) => {
          authOptions[enabledIdp.category + "_enabled"] = true;
          if (enabledIdp.signupLink) {
            authOptions[enabledIdp.category + "_signup_link"] =
              enabledIdp.signupLink;
            authOptions[enabledIdp.category + "_signup_link_enabled"] = true;
          }
        });
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
