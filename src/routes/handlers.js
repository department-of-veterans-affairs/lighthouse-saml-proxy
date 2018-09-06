import { getPath, getReqUrl } from "../utils";
import assignIn from "lodash.assignin";
import SessionParticipants from "samlp/lib/sessionParticipants";
import samlp from "samlp";

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

export const showUser = function (req, res, next) {
  const acsUrl = req.query.acsUrl ?
        getReqUrl(req, req.query.acsUrl) :
        getReqUrl(req, req.sp.options.requestAcsUrl);
  const authnRequest = req.authnRequest ? req.authnRequest : req.session.authnRequest;
  req.authnRequest = authnRequest;

  const params = req.sp.options.getAuthnRequestParams(
    acsUrl,
    req.query.forceauthn === '' || req.query.forceAuthn === '' || req.query.forceauthn || req.query.forceAuthn,
    req.authnRequest.relayState,
    req.query.authnContext
  );
  console.log('Generating SSO Request with Params ', params);
  req.passport.authenticate('wsfed-saml2', params)(req, res, next);
};

/**
 * Shared Handlers
 */

export const parseSamlRequest = function(req, res, next) {
  samlp.parseRequest(req, function(err, data) {
    if (err) {
      return res.render('error', {
        message: 'SAML AuthnRequest Parse Error: ' + err.message,
        error: err
      });
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
      console.log('Received AuthnRequest => \n', req.authnRequest);
    }
    return showUser(req, res, next);
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

  console.log('Processing SAML SLO request for participant => \n', req.participant);

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
      console.log('Destroying session ' + req.session.id + ' for participant', req.participant);
      req.session.destroy();
      callback();
    }
  })(req, res, next);
};

export const idpSignOut = function(req, res, next) {
  if (req.idp.options.sloUrl) {
    console.log('Initiating SAML SLO request for user: ' + req.user.userName +
                ' with sessionIndex: ' + getSessionIndex(req));
    res.redirect(IDP_PATHS.SLO);
  } else {
    console.log('SAML SLO is not enabled for SP, destroying IDP session');
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
  console.log('Sending SAML Response\nUser => \n%s\nOptions => \n',
              JSON.stringify(req.user, null, 2), authOptions);
  samlp.auth(authOptions)(req, res);
};

export const acsFactory = (app, acsUrl) => {
  app.get(
    getPath(acsUrl),
    function (req, res, next) {
      console.log(req.method);
      console.log(req.query);
      if (req.method === 'GET' && req.query && (req.query.SAMLResponse || req.body.wresult)) {
        req.body = req.query;
        const ssoResponse = {
          state: req.query.RelayState || req.body.wctx,
          url: getReqUrl(req, acsUrl)
        };
        req.session.ssoResponse = ssoResponse;
        console.log();
        console.log('Received SSO Response on ACS URL %s', ssoResponse.url);
        console.log();

        const params = req.sp.options.getResponseParams(ssoResponse.url);
        console.log('Validating SSO Response with Params ', params);
        assignIn(req.strategy.options, params);
        req.passport.authenticate('wsfed-saml2', params)(req, res, next);
      } else {
        res.redirect(SP_LOGIN_URL);
      }
    },
    function(req, res, next) {
      if (req.user && req.user.claims && req.user.claims.level_of_assurance != '3') {
        res.redirect(url.format({
          pathname: IDP_PATHS.SSO,
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
      console.log('SP Sending SAML Response\nUser => \n%s\nOptions => \n',
                  JSON.stringify(req.user, null, 2), authOptions);
      samlp.auth(authOptions)(req, res);
    }
  );
};
