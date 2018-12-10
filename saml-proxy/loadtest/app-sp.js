// This express app exists to simulate requests to Okta and Id.me for laod testing purposes.

const express = require('express');
const constants = require('../src/routes/constants');
const handlers = require('../src/routes/handlers');
const IdPMetadata = require("../src/idpMetadata");
const IDPConfig = require("../src/IDPConfig").default;
const SPConfig = require("../src/SPConfig").default;
const cli = require("../src/cli");
const session = require ("express-session");

const fs = require("fs");
const process = require("process");
const path = require("path");
const template = require("lodash.template");
const samlp = require("samlp");
const http = require('http');
const os = require('os');

const METADATA_TEMPLATE = template(
  fs.readFileSync(path.join(process.cwd(), './templates/metadata.tpl'), 'utf8')
);

function addRoutes(app, idpConfig, spConfig) {
  app.get(constants.SP_METADATA_URL, function(req, res, next) {
    const xml = METADATA_TEMPLATE(spConfig.getMetadataParams(req));
    res.set('Content-Type', 'text/xml');
    res.send(xml);
  });

  console.log(spConfig.acsUrls);
  spConfig.acsUrls.forEach((url) => {
    app.post(url, (req, res) => {
      res.send("Finished!");
    });
  });

  return app;
}

const handleMetadata = (argv) => {
  return (metadata) => {
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
  };
};

function runServer(argv) {
  IdPMetadata.fetch(argv.spIdpMetaUrl)
    .then(handleMetadata(argv))
    .then(() => {
      const app = express();
      const app = express();
      app.set('port', parseInt(process.env.PORT || argv.port) + 2);
      const spConfig = new SPConfig(argv);
      const idpConfig = new IDPConfig(argv);
      const httpServer = argv.idpHttps ?
            https.createServer({ key: argv.idpHttpsPrivateKey, cert: argv.idpHttpsCert }, app) :
            http.createServer(app);
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
