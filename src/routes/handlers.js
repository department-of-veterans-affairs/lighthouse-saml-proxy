import { IDP_SSO } from "./constants";
import { getPath, getReqUrl } from "../utils";
import assignIn from "lodash.assignin";
import SessionParticipants from "samlp/lib/sessionParticipants";
import samlp from "samlp";
import { SAML, samlp as _samlp } from "passport-wsfed-saml2";
import * as url from "url";

export const getHashCode = (str) => {
  var hash = 0;
  var i = 0;
  if (str.length == 0) return hash;
  for (i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

export const samlLogin = function(req, res, next) {
  const acsUrl = req.query.acsUrl ?
        getReqUrl(req, req.query.acsUrl) :
        getReqUrl(req, req.sp.options.requestAcsUrl);
  const authnRequest = req.authnRequest ? req.authnRequest : req.session.authnRequest;
  req.authnRequest = authnRequest;
  const samlp = new _samlp(req.sp.options.getResponseParams(), new SAML.SAML(req.sp.options.getResponseParams()));

  [
    ['id_me_login_link', 'http://idmanagement.gov/ns/assurance/loa/3'],
    ['dslogon_login_link', 'dslogon'],
    ['mhv_login_link', 'myhealthevet'],
    ['id_me_signup_link', 'http://idmanagement.gov/ns/assurance/loa/3', '&op=signup']
  ].reduce((memo, [key, authnContext, exParams = null]) => {
    const params = req.sp.options.getAuthnRequestParams(
      acsUrl,
      req.query.forceauthn === '' || req.query.forceAuthn === '' || req.query.forceauthn || req.query.forceAuthn,
      (req.authnRequest && req.authnRequest.relayState) || '/',
      authnContext
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
  }, Promise.resolve({})).then(
    (authOptions) => res.render('login_selection', authOptions)
  ).catch(next);
};

/**
 * Shared Handlers
 */

export const parseSamlRequest = function(req, res, next) {
  samlp.parseRequest(req, function(err, data) {
    if (err) {
      console.warn("Allowing login with no final redirect.");
      next();
    };
    if (data) {
      req.authnRequest = {
        relayState: req.query.RelayState || req.body.RelayState,
        id: data.id,
        issuer: data.issuer,
        destination: data.destination,
        acsUrl: data.assertionConsumerServiceURL,
        forceAuthn: data.forceAuthn === 'true'
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
  return {
    serviceProviderId: req.idp.options.serviceProviderId,
    sessionIndex: getSessionIndex(req),
    nameId: req.user.userName,
    nameIdFormat: req.user.nameIdFormat,
    serviceProviderLogoutURL: req.idp.options.sloUrl
  };
};

export const parseLogoutRequest = function(req, res, next) {
  if (!req.idp.options.sloUrl) {
    return res.render('error', {
      message: 'SAML Single Logout Service URL not defined for Service Provider'
    });
  };

  return samlp.logout({
    cert:                   req.idp.options.cert,
    key:                    req.idp.options.key,
    digestAlgorithm:        req.idp.options.digestAlgorithm,
    signatureAlgorithm:     req.idp.options.signatureAlgorithm,
    sessionParticipants:    new SessionParticipants(
      [
        req.participant
      ]),
    clearIdPSession: function(callback) {
      req.session.destroy();
      callback();
    }
  })(req, res, next);
};

export const idpSignOut = function(req, res, next) {
  if (req.idp.options.sloUrl) {
    res.redirect(IDP_PATHS.SLO);
  } else {
    req.session.destroy(function(err) {
      if (err) {
        throw err;
      }
      res.redirect('back');
    });
  }
};

export const idpSignIn = function(req, res) {
  const authOptions = extend({}, req.idp.options);
  Object.keys(req.body).forEach(function(key) {
    var buffer;
    if (key === '_authnRequest') {
      buffer = new Buffer(req.body[key], 'base64');
      req.authnRequest = JSON.parse(buffer.toString('utf8'));

      // Apply AuthnRequest Params
      authOptions.inResponseTo = req.authnRequest.id;
      if (req.idp.options.allowRequestAcsUrl && req.authnRequest.acsUrl) {
        authOptions.acsUrl = req.authnRequest.acsUrl;
        authOptions.recipient = req.authnRequest.acsUrl;
        authOptions.destination = req.authnRequest.acsUrl;
        authOptions.forceAuthn = req.authnRequest.forceAuthn;
      }
      if (req.authnRequest.relayState) {
        authOptions.RelayState = req.authnRequest.relayState;
      }
    } else {
      req.user[key] = req.body[key];
    }
  });

  if (!authOptions.encryptAssertion) {
    delete authOptions.encryptionCert;
    delete authOptions.encryptionPublicKey;
  }

  // Set Session Index
  authOptions.sessionIndex = getSessionIndex(req);

  // Keep calm and Single Sign On
  samlp.auth(authOptions)(req, res);
};

export const acsFactory = (app, acsUrl) => {
  app.get(
    getPath(acsUrl),
    function (req, res, next) {
      if (req.method === 'GET' && req.query && (req.query.SAMLResponse || req.body.wresult)) {
        const ssoResponse = {
          state: req.query.RelayState || req.body.wctx,
          url: getReqUrl(req, acsUrl)
        };
        req.session.ssoResponse = ssoResponse;

        const params = req.sp.options.getResponseParams(ssoResponse.url);
        assignIn(req.strategy.options, params);
        console.log(req.strategy.options);
        req.passport.authenticate('wsfed-saml2', params)(req, res, next);
      } else {
        res.redirect(SP_LOGIN_URL);
      }
    },
    function(req, res, next) {
      console.log(req.user);
      if (req.user && req.user.claims &&
          (req.user.claims.level_of_assurance !== '3' &&
           req.user.claims.dslogon_assurance !== '2')) {
        res.redirect(url.format({
          pathname: IDP_SSO,
          query: {
            authnContext: "http://idmanagement.gov/ns/assurance/loa/3"
          }
        }));
      }
      next();
    },
    function(req, res, next) {
      const authOptions = assignIn({}, req.idp.options);
      authOptions.RelayState = req.session.ssoResponse.state;
      samlp.auth(authOptions)(req, res);
    }
  );
};
