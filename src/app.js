
/**
 * Module dependencies.
 */

import express from "express";
import template from "lodash.template";
import omit from "lodash.omit";
import assignIn from "lodash.assignin";
import url from "url";
import fs from "fs";
import extend from "extend";
import hbs from "hbs";
import http from "http";
import https from "https";
import os from "os";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import bodyParser from "body-parser";
import session from "express-session";
import samlp from "samlp";
import xmlFormat from "xml-formatter";
import { SAML, Strategy } from "passport-wsfed-saml2";
import passport from "passport";
import { DOMParser } from "xmldom";
import SessionParticipants from "samlp/lib/sessionParticipants";
import SimpleProfileMapper from "./simpleProfileMapper";
import * as IdPMetadata from "./idpMetadata";
import * as cli from "./cli";

/**
 * Globals
 */

const IDP_PATHS = {
  SSO: '/samlproxy/idp/saml/sso',
  SLO: '/samlproxy/idp/saml/slo',
  METADATA: '/samlproxy/idp/metadata',
  SIGN_IN: '/samlproxy/idp/signin',
  SIGN_OUT: '/samlproxy/idp/signout',
  SETTINGS: '/samlproxy/idp/settings'
}

const AUTHN_REQUEST_TEMPLATE = template(
  fs.readFileSync(path.join(__dirname, '../templates/authnrequest.tpl'), 'utf8')
);
const METADATA_TEMPLATE = template(
  fs.readFileSync(path.join(__dirname, '../templates/metadata.tpl'), 'utf8')
);

const SP_SLO_URL = '/samlproxy/sp/saml/slo';
const SP_PROFILE_URL = '/samlproxy/sp/profile';
const SP_LOGIN_URL ='/samlproxy/sp/login';
const SP_LOGOUT_URL = '/samlproxy/sp/logout';
const SP_METADATA_URL = '/samlproxy/sp/metadata';
const SP_SETTINGS_URL = '/samlproxy/sp/settings';
const SP_ERROR_URL = '/samlproxy/sp/error';

const NAMEID_FORMAT_PREFERENCE = [
  'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
  'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
  'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
  'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  'urn:oasis:names:tc:SAML:2.0:nameid-format:kerberos',
  'urn:oasis:names:tc:SAML:1.1:nameid-format:WindowsDomainQualifiedName'
]

function getHashCode(str) {
  var hash = 0;
  if (str.length == 0) return hash;
  for (i = 0; i < str.length; i++) {
    char = str.charCodeAt(i);
    hash = ((hash<<5)-hash)+char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function getPath(path) {
  if (path) {
    return path.startsWith('/') ? path : '/' + path;
  }
}

function getReqUrl(req, path) {
  if (req) {
    return (req.get('x-forwarded-proto') || req.protocol) + '://' + (req.get('x-forwarded-host') || req.get('host')) + getPath(path || req.originalUrl);
  }
};

function removeHeaders(cert) {
  const pem = /-----BEGIN (\w*)-----([^-]*)-----END (\w*)-----/g.exec(cert);
  if (pem && pem.length > 0) {
    return pem[2].replace(/[\n|\r\n]/g, '');
  }
  return cert;
};

/**
 * Arguments
 */
function processArgs(args, options) {
  var baseArgv;
  console.log();
  console.log('loading configuration...');

  return baseArgv
    .wrap(baseArgv.terminalWidth());
}


function _runServer(argv) {
  IdPMetadata.fetch(argv.spIdpMetaUrl)
    .then((metadata) => {
      if (metadata.protocol) {
        argv.protocol = metadata.protocol;
        if (metadata.signingKeys[0]) {
          argv.spIdpCert = cli.certToPEM(metadata.signingKeys[0]);
        }

        switch (metadata.protocol) {
        case 'samlp':
          if (metadata.sso.redirectUrl) {
            argv.spIdpSsoUrl = metadata.sso.redirectUrl;
          } else if (metadata.sso.postUrl) {
            argv.spIdpSsoUrl = metadata.sso.postUrl;
          }
          if (metadata.slo.redirectUrl) {
            argv.spIdpSloUrl = metadata.slo.redirectUrl;
          } else if (metadata.slo.postUrl) {
            argv.spIdpSloUrl = metadata.slo.postUrl;
          }
          if (metadata.signRequest) {
            argv.spSignAuthnRequests = metadata.signRequest;
          }
          break;
        case 'wsfed':
          if (metadata.sso.redirectUrl) {
            argv.spIdpSsoUrl = metadata.sso.redirectUrl;
          }
          break;
        }
      }
    })
    .then(() => {
      const app = express();
      const httpServer = argv.idpHttps ?
            https.createServer({ key: argv.idpHttpsPrivateKey, cert: argv.idpHttpsCert }, app) :
            http.createServer(app);
      const blocks = {};

      console.log();
      console.log('Listener Port:\n\t' + argv.idpPort);
      console.log('HTTPS Enabled:\n\t' + argv.idpHttps);
      console.log();
      console.log('[IdP]');
      console.log();
      console.log('Issuer URI:\n\t' + argv.idpIssuer);
      console.log('Sign Response Message:\n\t' + argv.idpSignResponse);
      console.log('Encrypt Assertion:\n\t' + argv.idpEncryptAssertion);
      console.log('Authentication Context Class Reference:\n\t' + argv.idpAuthnContextClassRef);
      console.log('Authentication Context Declaration:\n\n' + argv.idpAuthnContextDecl);
      console.log('Default RelayState:\n\t' + argv.idpRelayState);
      console.log();
      console.log('[IdP SP]');
      console.log();
      console.log('Issuer URI:\n\t' + argv.idpServiceProviderId);
      console.log('Audience URI:\n\t' + argv.idpAudience);
      console.log('ACS URL:\n\t' + argv.idpAcsUrl);
      console.log('SLO URL:\n\t' + argv.idpSloUrl);
      console.log('Trust ACS URL in Request:\n\t' + !argv.idpDisableRequestAcsUrl);
      console.log();

      console.log();

      console.log('[SP]');
      console.log();
      console.log('Protocol: ' + "SAMLP");
      console.log();
      console.log('IdP Issuer URI:\n\t' + argv.spIdpIssuer);
      console.log('IdP SSO ACS URL:\n\t' + argv.spIdpSsoUrl);
      console.log('IdP SLO URL:\n\t' + argv.spIdpSloUrl);
      console.log();
      console.log('SP Issuer URI:\n\t' + argv.spAudience);
      console.log('SP Audience URI:\n\t' + argv.spAudience);
      console.log('SP NameID Format:\n\t' + argv.spNameIDFormat);
      console.log('SP ACS Binding:\n\turn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST');
      console.log('SP ACS URL:');
      argv.spAcsUrls.forEach(function(acsUrl) {
        console.log('\t' + acsUrl);
      });
      console.log('SP Default Relay State:\n\t' + argv.spRelayState);
      console.log();

      /**
       * IdP Configuration
       */

      SimpleProfileMapper.prototype.metadata = argv.idpConfig.metadata;

      const idpOptions = {
        idpBaseUrl:             argv.idpBaseUrl,
        issuer:                 argv.idpIssuer,
        serviceProviderId:      argv.idpServiceProviderId || argv.idpAudience,
        cert:                   argv.idpCert,
        key:                    argv.idpKey,
        audience:               argv.idpAudience,
        recipient:              argv.idpAcsUrl,
        destination:            argv.idpAcsUrl,
        acsUrl:                 argv.idpAcsUrl,
        sloUrl:                 argv.idpSloUrl,
        RelayState:             argv.idpRelayState,
        allowRequestAcsUrl:     !argv.idpDisableRequestAcsUrl,
        digestAlgorithm:        'sha256',
        signatureAlgorithm:     'rsa-sha256',
        signResponse:           argv.idpSignResponse,
        encryptAssertion:       argv.idpEncryptAssertion,
        encryptionCert:         argv.idpEncryptionCert,
        encryptionPublicKey:    argv.idpEncryptionPublicKey,
        encryptionAlgorithm:    'http://www.w3.org/2001/04/xmlenc#aes256-cbc',
        keyEncryptionAlgorithm: 'http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p',
        lifetimeInSeconds:      3600,
        authnContextClassRef:   argv.idpAuthnContextClassRef,
        authnContextDecl:       argv.idpAuthnContextDecl,
        includeAttributeNameFormat: true,
        profileMapper:          SimpleProfileMapper,
        postEndpointPath:       IDP_PATHS.SSO,
        redirectEndpointPath:   IDP_PATHS.SSO,
        logoutEndpointPaths:    argv.idpSloUrl ?
          {
            redirect: IDP_PATHS.SLO,
            post: IDP_PATHS.SLO
          } : {},
        getUserFromRequest:     function(req) { return req.user; },
        getPostURL:             function (audience, authnRequestDom, req, callback) {
          return callback(null, (req.authnRequest && req.authnRequest.acsUrl) ?
                          req.authnRequest.acsUrl :
                          argv.idpAcsUrl);
        },
        transformAssertion:     function(assertionDom) {
          if (argv.idpAuthnContextDecl) {
            var declDoc;
            try {
              declDoc = new Parser().parseFromString(argv.idpAuthnContextDecl);
            } catch(err){
              console.log('Unable to parse Authentication Context Declaration XML', err);
            }
            if (declDoc) {
              const authnContextDeclEl = assertionDom.createElementNS('urn:oasis:names:tc:SAML:2.0:assertion', 'saml:AuthnContextDecl');
              authnContextDeclEl.appendChild(declDoc.documentElement);
              const authnContextEl = assertionDom.getElementsByTagName('saml:AuthnContext')[0];
              authnContextEl.appendChild(authnContextDeclEl);
            }
          }
        },
        responseHandler:        function(response, opts, req, res, next) {
          console.log();
          console.log(`req.session.ssoResponse = ${JSON.stringify(req.session.ssoResponse)}\n`);
          console.log(`Sending SAMLResponse to ${opts.postUrl} with RelayState ${opts.RelayState} =>\n`);
          console.log(xmlFormat(response.toString(), {indentation: '  '}));
          console.log();
          res.render('samlresponse', {
            AcsUrl: opts.postUrl,
            SAMLResponse: response.toString('base64'),
            RelayState: opts.RelayState
          });
        }
      }

      const spConfig = {

        port: argv.spPort,
        protocol: argv.spProtocol,
        idpIssuer: argv.spIdpIssuer,
        idpSsoUrl: argv.spIdpSsoUrl,
        idpSsoBinding: argv.spIdpSsoBinding,
        idpSloUrl: argv.spIdpSloUrl,
        idpSloBinding: argv.spIdpSloBinding,
        idpCert: argv.spIdpCert,
        idpThumbprint: argv.spIdpThumbprint,
        idpMetaUrl: argv.spIdpMetaUrl,
        audience: argv.spAudience,
        providerName: argv.spProviderName,
        acsUrls: argv.spAcsUrls,
        signAuthnRequests: argv.spSignAuthnRequests,
        signatureAlgorithm: argv.spSignatureAlgorithm,
        digestAlgorithm: argv.spDigestAlgorithm,
        requestNameIDFormat: argv.spRequestNameIDFormat,
        validateNameIDFormat: argv.spValidateNameIDFormat,
        nameIDFormat: argv.spNameIDFormat,
        requestAuthnContext: argv.spRequestAuthnContext,
        authnContextClassRef: argv.spAuthnContextClassRef,
        spCert: argv.spCert,
        spKey: argv.spKey,
        httpsPrivateKey: argv.spHttpsPrivateKey,
        httpsCert: argv.spHttpsCert,
        https: argv.spHttps,
        relayState: argv.spRelayState,

        requestAcsUrl: argv.spAcsUrls[0],
        failureRedirect: SP_ERROR_URL,
        failureFlash: true,

        // can't use arrow functions due to lexical scoping

        getMetadataParams: function(req) {
          return {
            protocol: this.protocol,
            entityID: this.audience,
            realm: this.audience,
            cert: removeHeaders(this.spCert),
            acsUrls: this.acsUrls.map(url => getReqUrl(req, url)),
            sloUrl: getReqUrl(req, SP_SLO_URL),
            nameIDFormat: this.nameIDFormat
          }
        },

        getRequestSecurityTokenParams: function(wreply, wctx) {
          return {
            wreply: wreply,
            wctx:   wctx || this.relayState,
          }
        },
        getAuthnRequestParams: function(acsUrl, forceAuthn, relayState, authnContext) {
          const params = {
            protocol:             this.protocol,
            realm:                this.audience,
            callback:             acsUrl,
            protocolBinding:      this.idpSsoBinding,
            identityProviderUrl:  this.idpSsoUrl,
            providerName:         this.providerName,
            forceAuthn:           forceAuthn,
            authnContext:         authnContext || this.authnContextClassRef,
            requestContext: {
              NameIDFormat: this.nameIDFormat
            },
            requestTemplate:      AUTHN_REQUEST_TEMPLATE({
              ForceAuthn: forceAuthn,
              NameIDFormat: this.requestNameIDFormat,
              AuthnContext: this.requestAuthnContext,
            }),
            signatureAlgorithm:   this.signatureAlgorithm,
            digestAlgorithm:      this.digestAlgorithm,
            deflate:              this.deflate,
            RelayState:           relayState || this.relayState,
            failureRedirect:      this.failureRedirect,
            failureFlash:         this.failureFlash
          }

          if (this.signAuthnRequests) {
            params.signingKey = {
              cert: this.spCert,
              key: this.spKey
            }
          }
          return params;
        },
        getResponseParams: function(destinationUrl) {
          return {
            protocol: this.protocol,
            thumbprint: this.idpThumbprint,
            cert: removeHeaders(this.idpCert),
            realm: this.audience,
            identityProviderUrl:  this.idpSsoUrl,  //wsfed
            recipientUrl: destinationUrl,
            destinationUrl: destinationUrl,
            decryptionKey: this.spKey,
            checkResponseID: true,
            checkDestination: true,
            checkInResponseTo: true,
            checkExpiration: true,
            checkAudience: true,
            checkNameQualifier: true,
            checkSPNameQualifier: true,
            failureRedirect: this.failureRedirect,
            failureFlash: this.failureFlash
          }
        },

        getLogoutParams: function() {
          return {
            issuer: this.audience,
            protocolBinding: this.idpSloBinding,
            deflate: this.deflate,
            identityProviderUrl: this.idpSloUrl,
            identityProviderSigningCert: this.idpCert,
            key: this.spKey,
            cert: this.spCert
          }
        }

      };

      const responseParams = spConfig.getResponseParams();
      const strategy = new Strategy(responseParams,
                                        (profile, done) => {
                                          console.log();
                                          console.log('Assertion => ' + JSON.stringify(profile, null, '\t'));
                                          console.log();
                                          return done(null, {
                                            issuer: profile.issuer,
                                            userName: profile.nameIdAttributes.value,
                                            nameIdFormat: profile.nameIdAttributes.Format,
                                            authnContext: {
                                              sessionIndex: profile.sessionIndex,
                                              authnMethod: profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod']
                                            },
                                            claims: omit(
                                              profile,
                                              'issuer',
                                              'sessionIndex',
                                              'nameIdAttributes',
                                              'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
                                              'http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod'
                                            )
                                          });

                                        }
                                   );
      passport.use(strategy);

      passport.serializeUser(function(user, done) {
        done(null, user);
      });

      passport.deserializeUser(function(user, done) {
        done(null, user);
      });

      /**
       * App Environment
       */

      app.set('port', process.env.PORT || argv.idpPort);
      app.set('views', path.join(__dirname, '../views'));

      /**
       * View Engine
       */

      app.set('view engine', 'hbs');
      app.set('view options', { layout: 'layout' })
      app.engine('handlebars', hbs.__express);
      app.use(express.static(path.join(__dirname, 'public')));
      app.use('/samlproxy/idp/bower_components', express.static(__dirname + '/public/bower_components'))
      app.use(passport.initialize());

      // Register Helpers
      hbs.registerHelper('extend', function(name, context) {
        var block = blocks[name];
        if (!block) {
          block = blocks[name] = [];
        }

        block.push(context.fn(this));
      });

      hbs.registerHelper('block', function(name) {
        const val = (blocks[name] || []).join('\n');
        // clear the block
        blocks[name] = [];
        return val;
      });


      hbs.registerHelper('select', function(selected, options) {
        return options.fn(this).replace(
          new RegExp(' value=\"' + selected + '\"'), '$& selected="selected"');
      });

      hbs.registerHelper('getProperty', function(attribute, context) {
        return context[attribute];
      });

      hbs.registerHelper('serialize', function(context) {
        return new Buffer(JSON.stringify(context)).toString('base64');
      });

      /**
       * Middleware
       */

      app.use(logger(':date> :method :url - {:referrer} => :status (:response-time ms)', {
        skip: function (req, res)
        {
          return req.path.startsWith('/samlproxy/idp/bower_components') || req.path.startsWith('/samlproxy/idp/css');
        }
      }));
      app.use(bodyParser.urlencoded({extended: true}));
      app.use(cookieParser());
      app.use(session({
        secret: 'The universe works on a math equation that never even ever really ends in the end',
        resave: false,
        saveUninitialized: true,
        name: 'idp_sid',
        cookie: { maxAge: 60000 }
      }));

      /**
       * View Handlers
       */

      const showUser = function (req, res, next) {
        const acsUrl = req.query.acsUrl ?
              getReqUrl(req, req.query.acsUrl) :
              getReqUrl(req, spConfig.requestAcsUrl);
        const authnRequest = req.authnRequest ? req.authnRequest : req.session.authnRequest;
        req.authnRequest = authnRequest;

        params = spConfig.getAuthnRequestParams(
          acsUrl,
          req.query.forceauthn === '' || req.query.forceAuthn === '' || req.query.forceauthn || req.query.forceAuthn,
          req.authnRequest.relayState,
          req.query.authnContext
        );
        console.log('Generating SSO Request with Params ', params);
        passport.authenticate('wsfed-saml2', params)(req, res, next);
      };

      /**
       * Shared Handlers
       */

      const parseSamlRequest = function(req, res, next) {
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

      const getSessionIndex = function(req) {
        if (req && req.session) {
          return Math.abs(getHashCode(req.session.id)).toString();
        }
      };

      const getParticipant = function(req) {
        return {
          serviceProviderId: req.idp.options.serviceProviderId,
          sessionIndex: getSessionIndex(req),
          nameId: req.user.userName,
          nameIdFormat: req.user.nameIdFormat,
          serviceProviderLogoutURL: req.idp.options.sloUrl
        };
      };

      const parseLogoutRequest = function(req, res, next) {
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

      /**
       * Routes
       */

      app.use(function(req, res, next){
        if (argv.idpRollSession) {
          req.session.regenerate(function(err) {
            return next();
          });
        } else {
          next();
        }
      });

      app.use(function(req, res, next){
        req.user = argv.idpConfig.user;
        req.metadata = argv.idpConfig.metadata;
        req.idp = { options: idpOptions };
        req.participant = getParticipant(req);
        next();
      });

      app.get(['/', '/idp', IDP_PATHS.SSO], parseSamlRequest);
      app.post(['/', '/idp', IDP_PATHS.SSO], parseSamlRequest);

      app.get(IDP_PATHS.SLO, parseLogoutRequest);
      app.post(IDP_PATHS.SLO, parseLogoutRequest);

      app.post(IDP_PATHS.SIGN_IN, function(req, res) {
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
      });

      app.get(IDP_PATHS.METADATA, function(req, res, next) {
        samlp.metadata(req.idp.options)(req, res);
      });

      app.get(SP_METADATA_URL, function(req, res, next) {
        const xml = METADATA_TEMPLATE(spConfig.getMetadataParams(req));
        console.log(xml);
        res.set('Content-Type', 'text/xml');
        res.send(xml);
      });

      spConfig.acsUrls.forEach(function(acsUrl) {
        console.log(getPath(acsUrl));
        app.get(getPath(acsUrl),
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

                    const params = spConfig.getResponseParams(ssoResponse.url);
                    console.log('Validating SSO Response with Params ', params);
                    _.extend(strategy.options, params);
                    passport.authenticate('wsfed-saml2', params)(req, res, next);
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
                  const authOptions = extend({}, req.idp.options);
                  authOptions.RelayState = req.session.ssoResponse.state;
                  console.log('SP Sending SAML Response\nUser => \n%s\nOptions => \n',
                              JSON.stringify(req.user, null, 2), authOptions);
                  samlp.auth(authOptions)(req, res);
                });
      });

      app.get(IDP_PATHS.SIGN_OUT, function(req, res, next) {
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
          })
        }
      });

      // catch 404 and forward to error handler
      app.use(function(req, res, next) {
        const err = new Error('Route Not Found');
        err.status = 404;
        next(err);
      });

      // development error handler
      app.use(function(err, req, res, next) {
        if (err) {
          res.status(err.status || 500);
          res.render('error', {
            message: err.message,
            error: err
          });
        }
      });

      /**
       * Start IdP Web Server
       */

      console.log('starting idp server on port %s', app.get('port'));

      httpServer.listen(app.get('port'), function() {
        const scheme   = argv.idpHttps ? 'https' : 'http',
              address  = httpServer.address(),
              hostname = os.hostname();
        const baseUrl  = address.address === '0.0.0.0' || address.address === '::' ?
          scheme + '://' + hostname + ':' + address.port :
          scheme + '://localhost:' + address.port;

        console.log();
        console.log('SAML IdP Metadata URL: ');
        console.log('\t=> ' + baseUrl + IDP_PATHS.METADATA);
        console.log();
        console.log('SSO Bindings: ');
        console.log();
        console.log('\turn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST');
        console.log('\t\t=> ' + baseUrl + IDP_PATHS.SSO);
        console.log('\turn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect');
        console.log('\t\t=> ' + baseUrl + IDP_PATHS.SSO);
        console.log();
        if (argv.idpSloUrl) {
          console.log('SLO Bindings: ');
          console.log();
          console.log('\turn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST');
          console.log('\t\t=> ' + baseUrl + IDP_PATHS.SLO);
          console.log('\turn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect');
          console.log('\t\t=> ' + baseUrl + IDP_PATHS.SLO);
          console.log();
        }
        console.log('idp server ready');
        console.log('\t=> ' + baseUrl);
        console.log();
      });
    });
}

function runServer(options) {
  const args = urocessArgs([], options);
  return _runServer(args.argv);
}

function main () {
  _runServer(cli.processArgs());
}

module.exports = {
  runServer,
  main,
};

if (require.main === module) {
  main();
}
