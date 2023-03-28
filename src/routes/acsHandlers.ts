import { SP_VERIFY, SP_ERROR_URL } from "./constants";
import { getReqUrl, logRelayState, accessiblePhoneNumber } from "../utils";
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
  IdpLoginCounter,
} from "../metrics";
import rTracer from "cls-rtracer";
import { selectPassportStrategyKey } from "./passport";

const unknownUsersErrorTemplate = (error: any) => {
  // `error` comes from:
  // https://github.com/request/promise-core/blob/master/lib/errors.js
  if (
    error.name == "StatusCodeError" &&
    error.statusCode.toString() === "404"
  ) {
    return "icn_error";
  } else {
    return "internal_failure";
  }
};

export const urlUserErrorTemplate = () => {
  // `error` comes from:
  // https://github.com/request/promise-core/blob/master/lib/errors.js
  return "sensitive_error";
};

// This depends on being called after buildPassportLoginHandler because it uses
// the mapped claim mhv_account_type.
const sufficientLevelOfAssurance = (claims: any) => {
  if (claims.idp === "id_me" && claims.mhv_account_type) {
    logger.info("Checking MyHealtheVet LOA.");
    IdpLoginCounter.labels({ idp: "my_healthe_vet" }).inc();
    return claims.mhv_account_type === "Premium";
  } else if (claims.idp === "id_me" && claims.dslogon_assurance) {
    logger.info("Checking DsLogon LOA.");
    IdpLoginCounter.labels({ idp: "ds_logon" }).inc();
    return claims.dslogon_assurance === "2" || claims.dslogon_assurance === "3";
  } else if (claims.idp === "id_me") {
    logger.info("Checking ID.me LOA.");
    IdpLoginCounter.labels({ idp: "id_me" }).inc();
    return claims.level_of_assurance === "3";
  } else if (claims.idp === "logingov" && claims.ial && claims.aal) {
    logger.info("Checking LogonGov LOA.");
    IdpLoginCounter.labels({ idp: "login_gov" }).inc();
    return claims.aal >= 2 && claims.ial >= 2;
  }
};

export const buildPassportLoginHandler = (acsURL: string) => {
  return (req: IConfiguredRequest, res: Response, next: NextFunction) => {
    const authenticateCallBack = (
      _1: any,
      userInfo: any,
      err: any,
      status: any
    ) => {
      if (err.message) {
        logger.error(err.message);
        logger.error(status);
        return res.redirect(SP_ERROR_URL);
      }
      // userInfo contains the user object returned from the SAML identity provider,
      // in this case the happy path should simply pass forward the user identity
      // in the request which be validated later in the execution flow.
      req.user = userInfo;
      next();
    };
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
      if (req.options) {
        req.options.ssoResponse = ssoResponse;
      } else {
        req.options = { ssoResponse: ssoResponse };
      }
      const spIdpKey: string = selectPassportStrategyKey(req);
      const params = req.sps.options[spIdpKey].getResponseParams(
        ssoResponse.url
      );
      const strategyOptions = req.strategies.get(spIdpKey)?.options;
      assignIn(strategyOptions, params);
      const passport = preparePassport(req.strategies.get(spIdpKey));
      passport.authenticate("wsfed-saml2", params, authenticateCallBack)(
        req,
        res,
        next
      );
    } else {
      res.render("layout", {
        body: "error",
        request_id: rTracer.id(),
        message: "Invalid assertion response.",
        wrapper_tags: accessiblePhoneNumber,
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
        return req.mpiUserClient.getMpiTraitsForLoa3User(req.user.claims);
      }
    );

    logger.info("Retrieved user traits from MVI", {
      session,
      action,
      result: "success",
    });
    req.user.claims.icn = icn;
    if (first_name) {
      req.user.claims.firstName = first_name;
    } else {
      logger.warn("Null mpi_user first_name for " + icn);
    }
    if (last_name) {
      req.user.claims.lastName = last_name;
    } else {
      logger.warn("Null mpi_user last_name for " + icn);
    }
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
          return req.vsoClient.getVSOSearch(
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
      const error_payload = {
        body: unknownUsersErrorTemplate(mviError),
        request_id: rTracer.id(),
        wrapper_tags: accessiblePhoneNumber,
      };
      res.render("layout", error_payload);
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
  if (req.user.claims.idp === "logingov") {
    req.user.authnContext.authnMethod = "logingov";
  }

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
    ial: req.user.claims.ial,
    aal: req.user.claims.aal,
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
        return res.render("layout", {
          body: "sensitive_error",
          request_id: rTracer.id(),
        });
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
        return res.render("layout", {
          body: "sensitive_error",
          request_id: rTracer.id(),
        });
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
    authOptions.RelayState = req.options.ssoResponse.state;
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
