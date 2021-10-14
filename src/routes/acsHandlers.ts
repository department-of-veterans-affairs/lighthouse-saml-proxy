import { SP_VERIFY } from "./constants";
import { getReqUrl, logRelayState } from "../utils";
import { ICache, IConfiguredRequest } from "./types";
import { preparePassport } from "./passport";

import { NextFunction, Response } from "express";
import assignIn from "lodash.assignin";
import samlp from "samlp";
import * as url from "url";
import logger from "../logger";
import {
  MVIRequestMetrics,
  VSORequestMetrics,
  IRequestMetrics,
  IdpLoginMetrics,
} from "../metrics";
import rTracer from "cls-rtracer";

const unknownUsersErrorTemplate = (error: any) => {
  // `error` comes from:
  // https://github.com/request/promise-core/blob/master/lib/errors.js
  if (
    error.name == "StatusCodeError" &&
    error.statusCode.toString() === "404"
  ) {
    return "internalFailure.hbs";
  } else {
    return "icnError.hbs";
  }
};

export const urlUserErrorTemplate = () => {
  // `error` comes from:
  // https://github.com/request/promise-core/blob/master/lib/errors.js
  return "sensitiveError.hbs";
};

// This depends on being called after buildPassportLoginHandler because it uses
// the mapped claim mhv_account_type.
const sufficientLevelOfAssurance = (claims: any) => {
  if (claims.mhv_account_type) {
    logger.info("Checking MyHealtheVet LOA.");
    IdpLoginMetrics.myHealtheVetLoginCount.inc();
    return claims.mhv_account_type === "Premium";
  } else if (claims.dslogon_assurance) {
    logger.info("Checking DsLogon LOA.");
    IdpLoginMetrics.dsLogonLoginCounter.inc();
    return claims.dslogon_assurance === "2" || claims.dslogon_assurance === "3";
  } else {
    logger.info("Checking ID.me LOA.");
    IdpLoginMetrics.idMeLoginCounter.inc();
    return claims.level_of_assurance === "3";
  }
};

export const buildPassportLoginHandler = (acsURL: string) => {
  return (req: IConfiguredRequest, res: Response, next: NextFunction) => {
    logRelayState(req, logger, "from IDP");
    if (
      ((req.method === "GET" || req.method === "POST") &&
        req.query &&
        req.query.SAMLResponse) ||
      (req.body && req.body.SAMLResponse)
    ) {
      const ssoResponse = {
        state: req.query.RelayState || req.body.RelayState,
        url: getReqUrl(req, acsURL),
      };
      if (req.session) {
        req.session.ssoResponse = ssoResponse;
      }

      const params = req.sps.options.id_me.getResponseParams(ssoResponse.url);
      // Passport strategy selection will have to be here. defaults to id_me for now.
      const theOptions = req.strategies.get("id_me")?.options;
      assignIn(theOptions, params);
      const passport = preparePassport(req.strategies.get("id_me"));
      passport.authenticate("wsfed-saml2", params)(req, res, next);
    } else {
      res.render("error.hbs", {
        request_id: rTracer.id(),
        message: "Invalid assertion response.",
      });
    }
  };
};

export const loadICN = async (
  req: IConfiguredRequest,
  res: Response,
  next: NextFunction
) => {
  const session = req.sessionID;
  const action = "loadICN";

  try {
    const { icn, first_name, last_name } = await requestWithMetrics(
      MVIRequestMetrics,
      (): Promise<any> => {
        return req.vetsAPIClient.getMVITraitsForLoa3User(req.user.claims);
      }
    );

    logger.info("Retrieved user traits from MVI", {
      session,
      action,
      result: "success",
    });
    req.user.claims.icn = icn;
    req.user.claims.firstName = first_name;
    req.user.claims.lastName = last_name;
    next();
  } catch (mviError) {
    logger.warn("Failed MVI lookup; will try VSO search", {
      session,
      action,
      result: "failure",
    });

    try {
      await requestWithMetrics(
        VSORequestMetrics,
        (): Promise<any> => {
          return req.vetsAPIClient.getVSOSearch(
            req.user.claims.firstName,
            req.user.claims.lastName
          );
        }
      );
      next();
    } catch (error) {
      logger.error("Failed MVI lookup and VSO search", {
        session,
        action,
        result: "failure",
      });
      res.render(unknownUsersErrorTemplate(mviError), {
        request_id: rTracer.id(),
      });
    }
  }
};

export const scrubUserClaims = (
  req: IConfiguredRequest,
  res: Response,
  next: NextFunction
) => {
  // Makes sure we're only serializing user claims as SAML Assertions
  // that are safe to pass to Okta
  req.user.claims = {
    firstName: req.user.claims.firstName,
    lastName: req.user.claims.lastName,
    middleName: req.user.claims.middleName,
    email: req.user.claims.email,
    icn: req.user.claims.icn,
    uuid: req.user.claims.uuid,
    dslogon_assurance: req.user.claims.dslogon_assurance,
    mhv_account_type: req.user.claims.mhv_account_type,
    level_of_assurance: req.user.claims.level_of_assurance,
  };
  next();
};

export const testLevelOfAssuranceOrRedirect = (
  req: IConfiguredRequest,
  res: Response,
  next: NextFunction
) => {
  if (
    req.user &&
    req.user.claims &&
    !sufficientLevelOfAssurance(req.user.claims)
  ) {
    if (!req.query?.RelayState && !req.body?.RelayState) {
      throw {
        message: "Error: Empty relay state during loa test. Invalid request.",
        status: 400,
      };
    }
    res.redirect(
      url.format({
        pathname: SP_VERIFY,
        query: {
          authnContext: "http://idmanagement.gov/ns/assurance/loa/3",
          RelayState: req.query?.RelayState || req.body?.RelayState,
        },
      })
    );
  } else {
    next();
  }
};

export const validateIdpResponse = (cache: ICache, cacheEnabled: Boolean) => {
  return async (req: IConfiguredRequest, res: Response, next: NextFunction) => {
    if (cacheEnabled) {
      const sessionIndex = req?.user?.authnContext?.sessionIndex;
      if (!sessionIndex) {
        logger.error("No session index found in the saml response.");
        return res.render("sensitiveError.hbs", { request_id: rTracer.id() });
      }
      let sessionIndexCached = null;
      sessionIndexCached = await cache.has(sessionIndex).catch((err) => {
        logger.error(
          "Cache was unable to retrieve session index." + JSON.stringify(err)
        );
      });

      if (sessionIndexCached) {
        logger.error(
          "SAML response with session index " +
            sessionIndex +
            " was previously cached."
        );
        return res.render("sensitiveError.hbs", { request_id: rTracer.id() });
      }
      // Set the session index to expire after 6hrs, or 21600 seconds.
      await cache.set(sessionIndex, "", "EX", 21600);
      logger.info(
        "Caching valid Idp Saml Response with session index " + sessionIndex
      );
      return next();
    }
    return next();
  };
};

export const serializeAssertions = (
  req: IConfiguredRequest,
  res: Response,
  next: NextFunction
) => {
  const authOptions = assignIn({}, req.idp.options);
  const time = new Date().toISOString();
  if (req.session) {
    authOptions.RelayState = req.session.ssoResponse.state;
    const logObj = {
      session: req.sessionID,
      stateFromSession: true,
      step: "to Okta",
      time,
      relayState: authOptions.RelayState,
    };

    logger.info(
      `Relay state to Okta (from session): ${authOptions.RelayState}`,
      logObj
    );
  } else {
    logRelayState(req, logger, "to Okta");
  }
  authOptions.authnContextClassRef = req.user.authnContext.authnMethod;
  samlp.auth(authOptions)(req, res, next);
};

export async function requestWithMetrics(
  metrics: IRequestMetrics,
  promiseFunc: () => Promise<any>
) {
  const timer = metrics.histogram.startTimer();
  metrics.attempt.inc();
  try {
    const res = await promiseFunc();
    timer({ status_code: "200" });
    return res;
  } catch (err) {
    metrics.failure.inc();
    timer({ status_code: err.statusCode || "unknown" });
    throw err;
  }
}
