// This express app exists to simulate requests to Okta and Id.me for laod testing purposes.

const express = require('express');
const constants = require('../src/routes/constants');
const handlers = require('../src/routes/handlers');
const IdPMetadata = require("../src/idpMetadata");
const IDPConfig = require("../src/IDPConfig").default;
const SPConfig = require("../src/SPConfig").default;
const cli = require("../src/cli");
const configureHandlebars = require('../src/routes/handlebars').default;

const fs = require("fs");
const process = require("process");
const path = require("path");
const template = require("lodash.template");
const samlp = require("samlp");
const http = require('http');
const os = require('os');
const assignIn = require("lodash.assignin");
const session = require ("express-session");

const METADATA_TEMPLATE = template(
  fs.readFileSync(path.join(process.cwd(), './templates/metadata.tpl'), 'utf8')
);

function addRoutes(app, idpConfig, spConfig) {
  app.get(['/', '/idp', constants.IDP_SSO], handlers.parseSamlRequest, (req, res) => {
    req.user = { issuer: 'loadtest',
                 userName: '43bb64d44a44452a8b30929003a89f53',
                 nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
                 authnContext:
                 { sessionIndex: '_0342958353e84ec4afc641e27ff993c8',
                   authnMethod: 'http://idmanagement.gov/ns/assurance/loa/3' },
                 claims:
                 { birth_date: '1936-04-10',
                   email: 'vets.gov.user+503@id.me',
                   fname: 'Wendeline',
                   social: '564930708',
                   gender: 'Female',
                   lname: 'O\'Heffernan',
                   level_of_assurance: '3',
                   mname: 'Kitty',
                   multifactor: 'true',
                   uuid: '43bb64d44a44452a8b30929003a89f53' } }
    const authOptions = assignIn({}, req.idp.options);
    authOptions.RelayState = req.session.authnRequest.RelayState;
    samlp.auth(authOptions)(req, res);
  });
  app.post(['/', '/idp', constants.IDP_SSO], handlers.parseSamlRequest);

  app.post(constants.IDP_SIGN_IN, handlers.idpSignIn);

  app.get(constants.IDP_METADATA, function(req, res, next) {
    samlp.metadata(req.idp.options)(req, res);
  });

  return app;
}

function runServer(argv) {
  const app = express();
  const app = express();
  app.set('port', parseInt(process.env.PORT || argv.port) + 1);
  const spConfig = new SPConfig(argv);
  const idpConfig = new IDPConfig(argv);
  const httpServer = argv.idpHttps ?
        https.createServer({ key: argv.idpHttpsPrivateKey, cert: argv.idpHttpsCert }, app) :
        http.createServer(app);

  const hbs = configureHandlebars();
  app.set('view engine', 'hbs');
  app.set('view options', { layout: 'layout' });
  app.engine('handlebars', hbs.__express);

  app.use(session({
    secret: 'The universe works on a math equation that never even ever really ends in the end',
    resave: false,
    saveUninitialized: true,
    name: 'idp_sid',
    cookie: { maxAge: 60000 }
  }));

  app.use(function(req, res, next){
    req.user = argv.idpConfig.user;
    req.metadata = argv.idpConfig.metadata;
    req.sp = { options: spConfig };
    req.idp = { options: idpConfig };
    next();
  });
  addRoutes(app, idpConfig, spConfig);

  console.log('starting proxy server on port %s', app.get('port'));

  httpServer.listen(app.get('port'), function() {
    const scheme   = argv.idpHttps ? 'https' : 'http',
          address  = httpServer.address(),
          hostname = os.hostname();
    const baseUrl  = address.address === '0.0.0.0' || address.address === '::' ?
          scheme + '://' + hostname + ':' + address.port :
          scheme + '://localhost:' + address.port;
  });
}

function main () {
  runServer(cli.processArgs());
}

module.exports = {
  runServer,
  main,
};

if (require.main === module) {
  main();
}
