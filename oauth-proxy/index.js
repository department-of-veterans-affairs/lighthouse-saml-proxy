const express = require("express");
const cors = require("cors");
const { Issuer, custom } = require("openid-client");
const process = require("process");
const bodyParser = require("body-parser");
const { DynamoClient } = require("./dynamo_client");

const { processArgs } = require("./cli");
const okta = require("@okta/okta-sdk-nodejs");
const morgan = require("morgan");
const promBundle = require("express-prom-bundle");
const Sentry = require("@sentry/node");
const axios = require("axios");
const querystring = require("querystring");
const { middlewareLogFormat, winstonMiddleware, logger } = require("./logger");

const { jwtAuthorizationHandler } = require("./jwtAuthorizationHandler");
const oauthHandlers = require("./oauthHandlers");
const { configureTokenValidator } = require("./tokenValidation");
const rTracer = require("cls-rtracer");

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

async function createIssuer(upstream_issuer) {
  return await Issuer.discover(upstream_issuer);
}

function buildMetadataRewriteTable(config, api_category) {
  if (api_category === undefined) {
    api_category = "";
  }
  return {
    authorization_endpoint: `${config.host}${config.well_known_base_path}${api_category}${config.routes.app_routes.authorize}`,
    token_endpoint: `${config.host}${config.well_known_base_path}${api_category}${config.routes.app_routes.token}`,
    userinfo_endpoint: `${config.host}${config.well_known_base_path}${api_category}${config.routes.app_routes.userinfo}`,
    revocation_endpoint: `${config.host}${config.well_known_base_path}${api_category}${config.routes.app_routes.revoke}`,
    introspection_endpoint: `${config.host}${config.well_known_base_path}${api_category}${config.routes.app_routes.introspection}`,
    jwks_uri: `${config.host}${config.well_known_base_path}${api_category}${config.routes.app_routes.jwks}`,
  };
}

function filterProperty(object, property) {
  if (property in object) {
    object[property] = "[Filtered]";
  }
}

function buildApp(
  config,
  oktaClient,
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
  const redirect_uri = `${config.host}${well_known_base_path}${config.routes.app_routes.redirect}`;

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
  app.use(rTracer.expressMiddleware());
  app.use(morgan(middlewareLogFormat));
  app.use(winstonMiddleware);
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

  router.get(config.routes.app_routes.redirect, async (req, res, next) => {
    await oauthHandlers
      .redirectHandler(logger, dynamoClient, config, req, res, next)
      .catch(next);
  });

  const app_routes = config.routes.app_routes;
  Object.entries(config.routes.categories).forEach(([, isolatedOktaConfig]) => {
    const okta_client = isolatedOktaClients[isolatedOktaConfig.api_category];
    const service_issuer = isolatedIssuers[isolatedOktaConfig.api_category];
    buildMetadataForOpenIdConfiguration(
      isolatedOktaConfig.api_category,
      app_routes,
      service_issuer,
      okta_client
    );
  });
  if (config.enable_smart_launch_service) {
    router.get(
      config.routes.app_routes.smart_launch,
      jwtAuthorizationHandler,
      async (req, res, next) => {
        await oauthHandlers
          .launchRequestHandler(config, logger, dynamoClient, res, next)
          .catch(next);
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
    if (
      err.statusCode &&
      err.statusCode === 400 &&
      err.type === "entity.parse.failed"
    ) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "Invalid or unsupported content-type",
      });
    } else if (error && error_description) {
      res.status(500).json({
        error: "server_error",
        error_description: error_description,
      });
    } else {
      res.status(500).json({
        error: "server_error",
      });
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
      api_category
    );
    router.options(api_category + "/.well-known/*", corsHandler);
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
          dynamoClient,
          okta_client,
          req,
          res,
          next
        )
        .catch(next);
    });

    const staticTokens = new Map();
    router.post(api_category + app_routes.token, async (req, res, next) => {
      await oauthHandlers
        .tokenHandler(
          config,
          redirect_uri,
          logger,
          service_issuer,
          dynamoClient,
          validateToken,
          staticTokens,
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
        .revokeUserGrantHandler(okta_client, config, req, res, next)
        .catch(next);
    });
  }

  return app;
}

function startApp(config, isolatedIssuers) {
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

  const dynamoClient = new DynamoClient(
    Object.assign(
      {},
      { region: config.aws_region },
      config.aws_id === null ? null : { accessKeyId: config.aws_id },
      config.aws_secret === null ? null : { secretAccessKey: config.aws_secret }
    ),
    config.dynamo_local
  );

  const validateToken = configureTokenValidator(
    config.validate_post_endpoint,
    config.validate_apiKey
  );
  const app = buildApp(
    config,
    oktaClient,
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

      // configure OIDC client
      if (config.upstream_issuer_timeout_ms) {
        custom.setHttpOptionsDefaults({
          timeout: config.upstream_issuer_timeout_ms,
        });
      }

      const isolatedIssuers = {};
      if (config.routes && config.routes.categories) {
        for (const service_config of config.routes.categories) {
          isolatedIssuers[service_config.api_category] = await createIssuer(
            service_config.upstream_issuer
          );
        }
      }
      startApp(config, isolatedIssuers);
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
