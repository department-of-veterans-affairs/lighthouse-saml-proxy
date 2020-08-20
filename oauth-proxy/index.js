const express = require("express");
const cors = require("cors");
const { Issuer } = require("openid-client");
const process = require("process");
const bodyParser = require("body-parser");
const dynamoClient = require("./dynamo_client");
const { processArgs } = require("./cli");
const okta = require("@okta/okta-sdk-nodejs");
const morgan = require("morgan");
const promBundle = require("express-prom-bundle");
const Sentry = require("@sentry/node");
const axios = require("axios");
const querystring = require("querystring");
const { logger, middlewareLogFormat } = require("./logger");

const oauthHandlers = require("./oauthHandlers");
const { configureTokenValidator } = require("./tokenValidation");

const appRoutes = {
  authorize: "/authorization",
  token: "/token",
  userinfo: "/userinfo",
  introspection: "/introspect",
  manage: "/manage",
  revoke: "/revoke",
  jwks: "/keys",
  redirect: "/redirect",
  grants: "/grants",
};
const openidMetadataWhitelist = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "userinfo_endpoint",
  "introspection_endpoint",
  "revocation_endpoint",
  "jwks_uri",
  "scopes_supported",
  "response_types_supported",
  "response_modes_supported",
  "grant_types_supported",
  "subject_types_supported",
  "id_token_signing_alg_values_supported",
  "scopes_supported",
  "token_endpoint_auth_methods_supported",
  "revocation_endpoint_auth_methods_supported",
  "claims_supported",
  "code_challenge_methods_supported",
  "introspection_endpoint_auth_methods_supported",
  "request_parameter_supported",
  "request_object_signing_alg_values_supported",
];

async function createIssuer(upstream_issuer, upstream_issuer_timeout_ms) {
  if (upstream_issuer_timeout_ms) {
    Issuer.defaultHttpOptions = { timeout: upstream_issuer_timeout_ms };
  }
  return await Issuer.discover(upstream_issuer);
}

function buildMetadataRewriteTable(config, appRoutes, api_category) {
  if (api_category === undefined) {
    api_category = "";
  }
  return {
    authorization_endpoint: `${config.host}${config.well_known_base_path}${api_category}${appRoutes.authorize}`,
    token_endpoint: `${config.host}${config.well_known_base_path}${api_category}${appRoutes.token}`,
    userinfo_endpoint: `${config.host}${config.well_known_base_path}${api_category}${appRoutes.userinfo}`,
    revocation_endpoint: `${config.host}${config.well_known_base_path}${api_category}${appRoutes.revoke}`,
    introspection_endpoint: `${config.host}${config.well_known_base_path}${api_category}${appRoutes.introspection}`,
    jwks_uri: `${config.host}${config.well_known_base_path}${api_category}${appRoutes.jwks}`,
  };
}

function filterProperty(object, property) {
  if (property in object) {
    object[property] = "[Filtered]";
  }
}

function buildApp(
  config,
  issuer,
  oktaClient,
  dynamo,
  dynamoClient,
  validateToken,
  isolatedIssuers,
  isolatedOktaClients
) {
  const useSentry =
    config.sentry_dsn !== undefined && config.sentry_environment !== undefined;
  if (useSentry) {
    Sentry.init({
      dsn: config.sentry_dsn,
      environment: config.sentry_environment,
      beforeSend(event) {
        if (event.request) {
          filterProperty(event.request, "cookies");
          filterProperty(event.request.headers, "cookie");
          filterProperty(event.request.headers, "authorization");
        }
        return event;
      },
    });
  }

  const setProxyResponse = (response, targetResponse) => {
    if (response.headers !== undefined) {
      targetResponse.set(response.headers);
    }
    targetResponse.status(response.status);
    response.data.pipe(targetResponse);
  };

  const proxyRequestToOkta = (
    req,
    res,
    redirectUrl,
    requestMethod,
    bodyencoder
  ) => {
    delete req.headers.host;
    var payload = req.body;

    if (bodyencoder !== undefined) {
      payload = bodyencoder.stringify(req.body);
    }

    axios({
      method: requestMethod,
      data: payload,
      url: redirectUrl,
      headers: req.headers,
      responseType: "stream",
    })
      .then((response) => {
        setProxyResponse(response, res);
      })
      .catch((err) => {
        setProxyResponse(err.response, res);
      });
  };

  const { well_known_base_path } = config;
  const redirect_uri = `${config.host}${well_known_base_path}${appRoutes.redirect}`;

  /**
   * @deprecated - To be removed following AuthZ Server reorganization
   */
  const metadataRewrite = buildMetadataRewriteTable(config, appRoutes);

  const app = express();
  const router = new express.Router();
  // Express needs to know it is being ran behind a trusted proxy. Setting 'trust proxy' to true does a few things
  // but notably sets req.ip = 'X-Forwarded-for'. See http://expressjs.com/en/guide/behind-proxies.html
  app.set("trust proxy", true);
  if (useSentry) {
    app.use(
      Sentry.Handlers.requestHandler({
        user: false,
      })
    );
  }
  app.use(morgan(middlewareLogFormat));
  app.use(
    promBundle({
      includeMethod: true,
      includePath: true,
      customLabels: { app: "oauth_proxy" },
    })
  );

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json({ extended: true }));
  app.use(bodyParser.raw());

  const corsHandler = cors({
    origin: true,
    optionsSuccessStatus: 200,
    preflightContinue: true,
  });

  // @deprecated - To be removed following AuthZ Server reorganization
  router.options("/.well-known/*", corsHandler);

  // @deprecated - To be removed following AuthZ Server reorganization
  router.get("/.well-known/openid-configuration", corsHandler, (req, res) => {
    const baseMetadata = { ...issuer.metadata, ...metadataRewrite };
    const filteredMetadata = openidMetadataWhitelist.reduce((meta, key) => {
      meta[key] = baseMetadata[key];
      return meta;
    }, {});

    res.json(filteredMetadata);
  });

  // @deprecated - To be removed following AuthZ Server reorganization
  router.get(appRoutes.manage, (req, res) => {
    res.redirect(config.manage_endpoint);
  });

  // @deprecated - To be removed following AuthZ Server reorganization
  router.get(appRoutes.jwks, (req, res) =>
    proxyRequestToOkta(req, res, issuer.metadata.jwks_uri, "GET")
  );

  // @deprecated - To be removed following AuthZ Server reorganization
  router.get(appRoutes.userinfo, (req, res) =>
    proxyRequestToOkta(req, res, issuer.metadata.userinfo_endpoint, "GET")
  );

  // @deprecated - To be removed following AuthZ Server reorganization
  router.post(appRoutes.introspection, (req, res) =>
    proxyRequestToOkta(
      req,
      res,
      issuer.metadata.introspection_endpoint,
      "POST",
      querystring
    )
  );

  // @deprecated - To be removed following AuthZ Server reorganization
  router.post(appRoutes.revoke, (req, res) => {
    proxyRequestToOkta(
      req,
      res,
      issuer.metadata.revocation_endpoint,
      "POST",
      querystring
    );
  });

  router.get(appRoutes.redirect, async (req, res, next) => {
    await oauthHandlers
      .redirectHandler(logger, dynamo, dynamoClient, req, res, next)
      .catch(next);
  });

  // @deprecated - To be removed following AuthZ Server reorganization
  router.get(appRoutes.authorize, async (req, res, next) => {
    await oauthHandlers
      .authorizeHandler(
        config,
        redirect_uri,
        logger,
        issuer,
        dynamo,
        dynamoClient,
        oktaClient,
        req,
        res,
        next
      )
      .catch(next);
  });

  // @deprecated - To be removed following AuthZ Server reorganization
  router.post(appRoutes.token, async (req, res, next) => {
    await oauthHandlers
      .tokenHandler(
        config,
        redirect_uri,
        logger,
        issuer,
        dynamo,
        dynamoClient,
        validateToken,
        req,
        res,
        next
      )
      .catch(next);
  });

  // @deprecated - To be removed following AuthZ Server reorganization
  router.delete(appRoutes.grants, async (req, res, next) => {
    await oauthHandlers
      .revokeUserGrantHandler(config, req, res, next)
      .catch(next);
  });

  if (config.routes && config.routes.categories) {
    const app_routes = config.routes.app_routes;
    Object.entries(config.routes.categories).forEach(
      ([, isolatedOktaConfig]) => {
        const okta_client =
          isolatedOktaClients[isolatedOktaConfig.api_category];
        const service_issuer = isolatedIssuers[isolatedOktaConfig.api_category];
        buildMetadataForOpenIdConfiguration(
          isolatedOktaConfig.api_category,
          app_routes,
          service_issuer,
          okta_client
        );
      }
    );
  }

  app.use(well_known_base_path, router);

  // Error handlers. Keep as last middlewares

  // Sentry error handler must be the first error handling middleware
  if (useSentry) {
    app.use(
      Sentry.Handlers.errorHandler({
        shouldHandleError(error) {
          // Report 4xx and 5xx errors to sentry.
          // Including 4xx errors is a temporary change to get more insight
          // into errors reported by our users
          return error.status >= 400;
        },
      })
    );
  }

  app.use(function (err, req, res, next) {
    logger.error(err);

    // If we have error and description as query params display them, otherwise go to the
    // catchall error handler
    const { error, error_description } = req.query;
    if (error && error_description) {
      res.status(500).send(`${error}: ${error_description}`);
    } else {
      res.status(500).send("An unknown error has occured");
    }
  });

  function buildMetadataForOpenIdConfiguration(
    api_category,
    app_routes,
    service_issuer,
    okta_client
  ) {
    var servicesMetadataRewrite = buildMetadataRewriteTable(
      config,
      app_routes,
      api_category
    );
    router.get(
      api_category + "/.well-known/openid-configuration",
      corsHandler,
      (req, res) => {
        const baseServiceMetadata = {
          ...service_issuer.metadata,
          ...servicesMetadataRewrite,
        };
        const filteredServiceMetadata = openidMetadataWhitelist.reduce(
          (meta, key) => {
            meta[key] = baseServiceMetadata[key];
            return meta;
          },
          {}
        );

        res.json(filteredServiceMetadata);
      }
    );

    router.get(api_category + app_routes.authorize, async (req, res, next) => {
      await oauthHandlers
        .authorizeHandler(
          config,
          redirect_uri,
          logger,
          service_issuer,
          dynamo,
          dynamoClient,
          okta_client,
          req,
          res,
          next
        )
        .catch(next);
    });

    router.post(api_category + app_routes.token, async (req, res, next) => {
      await oauthHandlers
        .tokenHandler(
          config,
          redirect_uri,
          logger,
          service_issuer,
          dynamo,
          dynamoClient,
          validateToken,
          req,
          res,
          next
        )
        .catch(next);
    });

    router.get(api_category + app_routes.manage, (req, res) =>
      res.redirect(config.manage_endpoint)
    );
    router.get(api_category + app_routes.jwks, (req, res) =>
      proxyRequestToOkta(req, res, service_issuer.metadata.jwks_uri, "GET")
    );
    router.get(api_category + app_routes.userinfo, (req, res) =>
      proxyRequestToOkta(
        req,
        res,
        service_issuer.metadata.userinfo_endpoint,
        "GET"
      )
    );
    router.post(api_category + app_routes.introspection, (req, res) =>
      proxyRequestToOkta(
        req,
        res,
        service_issuer.metadata.introspection_endpoint,
        "POST",
        querystring
      )
    );

    router.post(api_category + app_routes.revoke, (req, res) => {
      proxyRequestToOkta(
        req,
        res,
        service_issuer.metadata.revocation_endpoint,
        "POST",
        querystring
      );
    });

    router.delete(api_category + app_routes.grants, async (req, res, next) => {
      await oauthHandlers
        .revokeUserGrantHandler(config, req, res, next)
        .catch(next);
    });
  }

  return app;
}
function startApp(config, issuer, isolatedIssuers) {
  const oktaClient = new okta.Client({
    orgUrl: config.okta_url,
    token: config.okta_token,
    requestExecutor: new okta.DefaultRequestExecutor(),
  });

  const isolatedOktaClients = {};
  if (config.routes && config.routes.categories) {
    Object.entries(config.routes.categories).forEach(
      ([, isolatedOktaConfig]) => {
        isolatedOktaClients[isolatedOktaConfig.api_category] = new okta.Client({
          orgUrl: config.okta_url,
          token: config.okta_token,
          requestExecutor: new okta.DefaultRequestExecutor(),
        });
      }
    );
  }

  const dynamoHandle = dynamoClient.createDynamoHandle(
    Object.assign(
      {},
      { region: config.aws_region },
      config.aws_id === null ? null : { accessKeyId: config.aws_id },
      config.aws_secret === null ? null : { secretAccessKey: config.aws_secret }
    ),
    config.dynamo_local,
    config.dynamo_table_name
  );

  const validateToken = configureTokenValidator(
    config.validate_endpoint,
    config.validate_apiKey
  );
  const app = buildApp(
    config,
    issuer,
    oktaClient,
    dynamoHandle,
    dynamoClient,
    validateToken,
    isolatedIssuers,
    isolatedOktaClients
  );
  const env = app.get("env");
  const server = app.listen(config.port, () => {
    logger.info(
      `OAuth Proxy listening on port ${config.port} in ${env} mode!`,
      {
        env,
        port: config.port,
      }
    );
  });
  server.keepAliveTimeout = 75000;
  server.headersTimeout = 75000;
  return null;
}

// Only start the server if this is being run directly. This is to allow the
// test suite to import this module without starting the server. We should be
// able to get rid of this conditional once we break up this module but we
// can't do that until we have more tests in place.
if (require.main === module) {
  (async () => {
    try {
      const config = processArgs();
      const issuer = await createIssuer(
        config.upstream_issuer,
        config.upstream_issuer_timeout_ms
      );
      const isolatedIssuers = {};
      if (config.routes && config.routes.categories) {
        for (const service_config of config.routes.categories) {
          isolatedIssuers[service_config.api_category] = await createIssuer(
            service_config.upstream_issuer,
            config.upstream_issuer_timeout_ms
          );
        }
      }
      startApp(config, issuer, isolatedIssuers);
    } catch (error) {
      logger.error("Could not start the OAuth proxy", error);
      process.exit(1);
    }
  })();
}

module.exports = {
  buildApp,
  createIssuer,
  startApp,
};
