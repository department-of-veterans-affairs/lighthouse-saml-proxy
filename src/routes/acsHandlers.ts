import { SP_VERIFY, SP_ERROR_URL } from "./constants";
import {
  getReqUrl,
  logRelayState,
  accessiblePhoneNumber,
  getSamlId,
  getRelayState,
} from "../utils";
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
  if (error.name == "MPILookupFailure" && error.statusCode === 404) {
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
    IdpLoginCounter.mhv();
    return claims.mhv_account_type === "Premium";
  } else if (claims.idp === "id_me" && claims.dslogon_assurance) {
    logger.info("Checking DsLogon LOA.");
    IdpLoginCounter.dslogon();
    return claims.dslogon_assurance === "2" || claims.dslogon_assurance === "3";
  } else if (claims.idp === "id_me") {
    logger.info("Checking ID.me LOA.");
    IdpLoginCounter.idme();
    return claims.level_of_assurance === "3";
  } else if (claims.idp === "logingov" && claims.ial && claims.aal) {
    logger.info("Checking LogonGov LOA.");
    IdpLoginCounter.logingov();
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
        state: getRelayState(req),
        url: getReqUrl(req, acsURL),
      };
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
  const session = getSamlId(req);
  const action = "loadICN";

  try {
    const {
      icn,
      first_name,
      last_name,
      idTheftIndicator,
    } = await requestWithMetrics(
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

    if (req.mpiUserClient.fraudBlockEnabled && idTheftIndicator) {
      logger.warn("Fradulent identity detected, blocking login.");
      return res.render("layout", {
        body: "sensitive_error",
        request_id: rTracer.id(),
      });
    }
    req.user.claims.icn = icn;
    if (first_name) {
      req.user.claims.firstName = first_name;
    } else {
      logger.warn("Null mpi_user first_name");
    }
    if (last_name) {
      req.user.claims.lastName = last_name;
    } else {
      logger.warn("Null mpi_user last_name");
    }
    next();
  } catch (mviError) {
    if (mviError?.statusCode == 503) {
      logger.warn(mviError?.message, {
        session,
        action,
        result: "failure",
      });
      return res.render("layout", {
        body: unknownUsersErrorTemplate(mviError),
        request_id: rTracer.id(),
        wrapper_tags: accessiblePhoneNumber,
      });
    }

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
      // @ts-ignore
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
    if (!getRelayState(req)) {
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
          RelayState: getRelayState(req),
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
      const samlId = getSamlId(req);
      if (!samlId) {
        logger.error("No ID found in the saml response.");
        return res.render("layout", {
          body: "sensitive_error",
          request_id: rTracer.id(),
        });
      }
      let isReplay: boolean | void;
      isReplay = await cache.has(samlId).catch((err) => {
        logger.error(
          "Cache was unable to retrieve SAML ID." + JSON.stringify(err)
        );
      });

      if (isReplay) {
        logger.error(
          "SAML response with SAML ID " + samlId + " was previously cached."
        );
        return res.render("layout", {
          body: "sensitive_error",
          request_id: rTracer.id(),
        });
      }
      // Set the session index to expire after 6hrs, or 21600 seconds.
      await cache.set(samlId, "", "EX", 21600);
      logger.info("Caching valid Idp Saml Response with SAML ID " + samlId);
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
  authOptions.inResponseTo = getSamlId(req);
  authOptions.RelayState = getRelayState(req);
  authOptions.authnContextClassRef = req.user.authnContext.authnMethod;
  logger.info("Serialize assertions for SAMLResponse", {
    session: authOptions.inResponseTo,
    step: "to Okta",
    time,
    relayState: authOptions.RelayState,
  });
  samlp.auth(authOptions)(req, res, next);
};
/**
 * Creates an asynchronous request with metrics using the
 * MVIRequestMetrics and creates a const timer to record
 * status codes
 *
 * @param metrics the param uses type IRequestMetrics
 * @param promiseFunc calls the Promise function
 * @returns returns a response which uses param promiseFunc() or throws an error
 */
export async function requestWithMetrics(
  metrics: IRequestMetrics,
  promiseFunc: () => Promise<any>
) {
  const timer = metrics.timer;
  timer.start();
  metrics.attempt();
  try {
    const res = await promiseFunc();
    timer.stop();
    return res;
  } catch (err) {
    metrics.failure();
    timer.stop();
    throw err;
  }
}
