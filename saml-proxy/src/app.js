
/**
 * Module dependencies.
 */

import express from "express";
import http from "http";
import https from "https";
import os from "os";
import * as IdPMetadata from "./idpMetadata";
import * as cli from "./cli";
import IDPConfig from "./IDPConfig";
import SPConfig from "./SPConfig";
import configureExpress from "./routes";

/**
 * Globals
 */

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
      const httpServer = argv.idpHttps ?
            https.createServer({ key: argv.idpHttpsPrivateKey, cert: argv.idpHttpsCert }, app) :
            http.createServer(app);

      const spConfig = new SPConfig(argv);
      const idpConfig = new IDPConfig(argv);
      configureExpress(app, argv, idpConfig, spConfig);

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
