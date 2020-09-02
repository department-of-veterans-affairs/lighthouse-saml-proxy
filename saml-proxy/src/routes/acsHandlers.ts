import { IDP_SSO, SP_VERIFY, SP_LOGIN_URL } from "./constants";
import { getReqUrl, logRelayState } from "../utils";
import { IConfiguredRequest } from "./types";

import { NextFunction, Response } from "express";
import assignIn from "lodash.assignin";
import samlp from "samlp";
import * as url from "url";
import logger from "../logger";
import {
  MVIRequestMetrics,
  VSORequestMetrics,
  IRequestMetrics,
} from "../metrics";

const unknownUsersErrorTemplate = (error: any) => {
  // `error` comes from:
  // https://github.com/request/promise-core/blob/master/lib/errors.js
  if (
    error.name == "StatusCodeError" &&
    error.statusCode.toString() === "404"
  ) {
    return "handleFailure.hbs";
  } else {
    return "icnError.hbs";
  }
};

export const urlUserErrorTemplate = (error: any) => {
  // `error` comes from:
  // https://github.com/request/promise-core/blob/master/lib/errors.js
  return "handleFailure.hbs";
};

// This depends on being called after buildPassportLoginHandler because it uses
// the mapped claim mhv_account_type.
const sufficientLevelOfAssurance = (claims: any) => {
  if (claims.mhv_account_type) {
    return claims.mhv_account_type === "Premium";
  } else if (claims.dslogon_assurance) {
    return claims.dslogon_assurance === "2" || claims.dslogon_assurance === "3";
  } else {
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

      const params = req.sp.options.getResponseParams(ssoResponse.url);
      assignIn(req.strategy.options, params);
      req.passport.authenticate("wsfed-saml2", params)(req, res, next);
    } else {
      res.redirect(SP_LOGIN_URL);
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
      res.render(unknownUsersErrorTemplate(mviError), {});
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
    res.redirect(
      url.format({
        pathname: SP_VERIFY,
        query: {
          authnContext: "http://idmanagement.gov/ns/assurance/loa/3",
        },
      })
    );
  } else {
    next();
  }
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
