import { IDP_SSO, SP_VERIFY, SP_LOGIN_URL } from "./constants";
import { getReqUrl } from '../utils';
import { IConfiguredRequest } from './types';

import { NextFunction, Response } from "express";
import assignIn from 'lodash.assignin';
import samlp from "samlp";
import * as url from "url";

const mviErrorTemplate = (error: any) => {
  // `error` comes from:
  // https://github.com/request/promise-core/blob/master/lib/errors.js

  if ((error.name == 'StatusCodeError') && (error.statusCode.toString() === '404')) {
    return 'icnLookupFailure.hbs';
  } else {
    return 'icnError.hbs';
  }
}

export const sufficientLevelOfAssurance = (claims: any) => {
  if (claims.mhv_profile) {
    var profile = JSON.parse(claims.mhv_profile);
    return (profile.accountType == 'Premium');
  }
  else if (claims.dslogon_assurance) {
    return (claims.dslogon_assurance == '2' || claims.dslogon_assurance == '3');
  }
  else {
    return claims.level_of_assurance == '3';
  }
};

export const passportLogin = (acsURL: string) => {
  return (req: IConfiguredRequest, res: Response, next: NextFunction) => {
    if ((req.method === 'GET' || req.method === 'POST')
        && (req.query && req.query.SAMLResponse)
        || (req.body && req.body.SAMLResponse)) {
      const ssoResponse = {
        state: req.query.RelayState || req.body.RelayState,
        url: getReqUrl(req, acsURL)
      };
      if (req.session) {
        req.session.ssoResponse = ssoResponse;
      }

      const params = req.sp.options.getResponseParams(ssoResponse.url);
      assignIn(req.strategy.options, params);
      req.passport.authenticate('wsfed-saml2', params)(req, res, next);
    } else {
      res.redirect(SP_LOGIN_URL);
    }
  }
};

export const loadICN = async (req: IConfiguredRequest, res: Response, next: NextFunction) => {
  if ((req.user.claims.icn != null) && (req.user.claims.icn !== '')) {
    // If the user already has an ICN, there's no need to lookup their ICN.
    // MHV is the only provider that sends back a ICN. They don't send back
    // the name/DOB/etc attributes that would be required to lookup the ICN
    // so it's also hard to verify.
    next();
  } else {
    try {
      const icn = await req.vetsAPIClient.getICN(req.user.claims);
    } catch (error) {
      res.render(mviErrorTemplate(error), {});
    }
  }
}

export const scrubUserClaims = (req: IConfiguredRequest, res: Response, next: NextFunction) => {
  // Makes sure we're only serializing user claims as SAML Assertions
  // that are safe to pass to Okta
  req.user.claims = {
    firstName: req.user.claims.firstName,
    lastName: req.user.claims.lastName,
    middleName: req.user.claims.middleName,
    email: req.user.claims.email,
    icn: req.user.claims.icn,
    uuid: req.user.claims.uuid,
  };
  next();
}

export const testLevelOfAssuranceOrRedirect = (req: IConfiguredRequest, res: Response, next: NextFunction) => {
  if (req.user && req.user.claims &&
      !sufficientLevelOfAssurance(req.user.claims)) {
    res.redirect(url.format({
      pathname: SP_VERIFY,
      query: {
        authnContext: "http://idmanagement.gov/ns/assurance/loa/3"
      }
    }));
  }
  next();
}

export const serializeAssertions = (req: IConfiguredRequest, res: Response, next: NextFunction) => {
  const authOptions = assignIn({}, req.idp.options);
  if (req.session) {
    authOptions.RelayState = req.session.ssoResponse.state;
  }
  authOptions.authnContextClassRef = req.user.authnContext.authnMethod;
  samlp.auth(authOptions)(req, res, next);
};

