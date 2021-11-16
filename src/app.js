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
      argv.spProtocol = metadata.protocol;
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
  const app = express();
  const httpServer = http.createServer(app);
  const idpConfig = new IDPConfig(argv);
  const vaConfig = new VetsAPIConfig(argv);
  const vetsApiClient = new VetsAPIClient(vaConfig.token, vaConfig.apiHost);
  let cache = null;
  const cacheEnabled = argv.cacheEnabled;
  if (cacheEnabled) {
    cache = new RedisCache(argv.redisPort, argv.redisHost);
  }
  const strategies = new Map();
  const spConfigs = {};
  if (!argv.idpConfigDrivenRefactor) {
    legacyConfigSetup(argv, spConfigs);
  }
  argv.idpSamlLogins.forEach((spIdpEntry) => {
    IdPMetadata.fetch(spIdpEntry.spIdpMetaUrl)
      .then(handleMetadata(spIdpEntry))
      .then(() => {
        spIdpEntry.spKey = argv.spKey;
        spConfigs[spIdpEntry.category] = new SPConfig(spIdpEntry);
        strategies.set(
          spIdpEntry.category,
          createPassportStrategy(spConfigs[spIdpEntry.category])
        );
      });
  });
  app.use(passport.initialize());
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
}

const legacyConfigSetup = (argv) => {
  argv.legacySpAuthnContextClassRef.forEach((legacyConfigSetup) => {
    argv.idpSamlLogins.push({
      category: legacyConfigSetup.category,
      spAuthnContextClassRef: legacyConfigSetup.spAuthnContextClassRef,
      spIdpSignupOp: legacyConfigSetup.spIdpSignupOp,
      spIdpMetaUrl: argv.spIdpMetaUrl,
      spNameIDFormat: argv.spNameIDFormat,
      spAudience: argv.spAudience,
      spRequestAuthnContext: argv.spRequestAuthnContext,
      spRequestNameIDFormat: argv.spRequestNameIDFormat,
      spCert: argv.spCert,
      spKey: argv.spKey,
      spProtocol: argv.spProtocol,
    });
  });
};

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
