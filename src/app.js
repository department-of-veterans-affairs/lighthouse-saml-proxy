/**
 * Module dependencies.
 */

import express from "express";
import http from "http";
import * as IdPMetadata from "./idpMetadata";
import * as cli from "./cli";
import IDPConfig from "./IDPConfig";
import SPConfig from "./SPConfig";
import VetsAPIConfig from "./VetsAPIConfig";
import configureExpress from "./routes";
import logger from "./logger";
import { VetsAPIClient } from "./VetsAPIClient";
import { RedisCache } from "./routes/types";
import createPassportStrategy from "./routes/passport";
import passport from "passport";

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
        case "samlp":
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
          if (metadata.NameIDFormat) {
            argv.spNameIDFormat = metadata.NameIDFormat;
          }
          break;
        case "wsfed":
          if (metadata.sso.redirectUrl) {
            argv.spIdpSsoUrl = metadata.sso.redirectUrl;
          }
          break;
      }
    }
  };
};

function runServer(argv) {
  const strategies = new Map();
  IdPMetadata.fetch(argv.spIdpMetaUrl)
    .then(handleMetadata(argv))
    .then(() => {
      const app = express();
      const httpServer = http.createServer(app);
      const spConfigs = { id_me: new SPConfig(argv) };
      strategies.set("id_me", createPassportStrategy(spConfigs.id_me));
      app.use(passport.initialize());
      if (argv.otherLogins) {
        argv.otherLogins.forEach((spIdpEntry) => {
          IdPMetadata.fetch(spIdpEntry.spIdpMetaUrl)
            .then(handleMetadata(spIdpEntry))
            .then(() => {
              spConfigs[spIdpEntry.idp_category] = new SPConfig(spIdpEntry);
              strategies.set(
                spIdpEntry.idp_category,
                createPassportStrategy(spConfigs[spIdpEntry.idp_category])
              );
            });
        });
      }
      const idpConfig = new IDPConfig(argv);
      const vaConfig = new VetsAPIConfig(argv);
      const vetsApiClient = new VetsAPIClient(vaConfig.token, vaConfig.apiHost);
      let cache = null;
      const cacheEnabled = argv.cacheEnabled;
      if (cacheEnabled) {
        cache = new RedisCache(argv.redisPort, argv.redisHost);
      }
      configureExpress(
        app,
        argv,
        idpConfig,
        spConfigs,
        strategies,
        vetsApiClient,
        cache,
        cacheEnabled
      );

      const env = app.get("env"),
        port = app.get("port");
      logger.info(`Starting proxy server on port ${port} in ${env} mode`, {
        env,
        port,
      });
      httpServer.keepAliveTimeout = 75000;
      httpServer.headersTimeout = 75000;
      httpServer.listen(app.get("port"));
    });
}

function main() {
  runServer(cli.processArgs());
}

module.exports = {
  runServer,
  main,
};

if (require.main === module) {
  main();
}
