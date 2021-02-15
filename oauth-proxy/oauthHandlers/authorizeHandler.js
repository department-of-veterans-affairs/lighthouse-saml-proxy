const { URLSearchParams, URL } = require("url");
const { loginBegin } = require("../metrics");

const authorizeHandler = async (
  config,
  redirect_uri,
  logger,
  issuer,
  dynamoClient,
  oktaClient,
  slugHelper,
  req,
  res,
  next
) => {
  loginBegin.inc();
  const { state, client_id, aud, redirect_uri: client_redirect } = req.query;
  const app_category = config.routes.categories.find((item) => {
    return item.api_category + config.routes.app_routes.authorize === req.path;
  });

  if (!app_category) {
    res.status(400).json({
      error: "invalid_request",
      error_description:
        "Invalid path attempted for authorization: '" + req.path + "'",
    });
    return next();
  }

  try {
    await checkParameters(
      state,
      aud,
      issuer,
      logger,
      oktaClient,
      client_redirect
    );
  } catch (err) {
    if (err.status == 500) {
      return next(err);
    }
    res.status(err.status).json({
      error: err.error,
      error_description: err.error_description,
    });
    return next();
  }

  if (app_category.client_store && app_category.client_store === "local") {
    await localValidateClient(
      config,
      logger,
      client_id,
      client_redirect,
      dynamoClient,
      res,
      next
    );
  } else {
    try {
      const oktaApp = await oktaClient.getApplication(client_id);
      if (
        oktaApp.settings.oauthClient.redirect_uris.indexOf(client_redirect) ===
        -1
      ) {
        res.status(400).json({
          error: "invalid_client",
          error_description:
            "The redirect URI specified by the application does not match any of the " +
            `registered redirect URIs. Erroneous redirect URI: ${client_redirect}`,
        });
        return next();
      }
    } catch (error) {
      // This error is unrecoverable because we would be unable to verify
      // that we are redirecting to a whitelisted client url
      logger.error(
        "Unrecoverable error: could not get the Okta client app",
        error
      );

      res.status(400).json({
        error: "invalid_client",
        error_description:
          "The client specified by the application is not valid.",
      });
      return next();
    }
  }

  try {
    let authorizePayload = { state: state, redirect_uri: client_redirect };

    // If the launch scope is included then also
    // save the launch context provided (if any)
    if (req.query.scope && req.query.scope.split(" ").includes("launch")) {
      if (req.query.launch) {
        authorizePayload.launch = req.query.launch;
      }
    }

    await dynamoClient.savePayloadToDynamo(
      authorizePayload,
      config.dynamo_table_name
    );
  } catch (error) {
    logger.error(
      `Failed to save client redirect URI ${client_redirect} in authorize handler`
    );
    return next(error); // This error is unrecoverable because we can't create a record to lookup the requested redirect
  }
  const params = new URLSearchParams(req.query);
  params.set("redirect_uri", redirect_uri);
  if (params.has("idp")) {
    params.set("idp", slugHelper.rewrite(params.get("idp")));
  } else if (!params.has("idp") && config.idp) {
    params.set("idp", config.idp);
  }

  res.redirect(
    `${issuer.metadata.authorization_endpoint}?${params.toString()}`
  );
};

const checkParameters = async (
  state,
  aud,
  issuer,
  logger,
  oktaClient,
  client_redirect
) => {
  if (!client_redirect) {
    logger.error("No valid redirect_uri was found.");
    throw {
      status: 400,
      error: "invalid_client",
      error_description:
        "There was no redirect URI specified by the application.",
    };
  }
  if (!state) {
    logger.error("No valid state parameter was found.");
    throw {
      status: 400,
      error: "invalid_request",
      error_description: "State parameter required",
    };
  }

  if (aud) {
    let authorizationServerId = new URL(issuer.metadata.issuer).pathname
      .split("/")
      .pop();
    let serverAudiences;

    await oktaClient
      .getAuthorizationServer(authorizationServerId)
      .then((res) => {
        serverAudiences = res.audiences;
      })
      .catch(() => {
        logger.error("Unable to get the authorization server.");
        throw { status: 500 };
      });

    if (!serverAudiences.includes(aud)) {
      logger.warn({
        message: "Unexpected audience",
        actual: aud,
        expected: serverAudiences,
      });
    }
  }
};

const localValidateClient = async (
  config,
  logger,
  client_id,
  client_redirect,
  dynamoClient,
  res,
  next
) => {
  try {
    let clientInfo = await dynamoClient.getPayloadFromDynamo(
      {
        client_id: client_id,
      },
      config.dynamo_clients_table
    );
    if (clientInfo.Item) {
      clientInfo = clientInfo.Item;
    } else {
      res.status(400).json({
        error: "invalid_client",
        error_description: "Invalid client for the authorization path",
      });
      return next();
    }
    if (!clientInfo.redirect_uris.values.includes(client_redirect)) {
      res.status(400).json({
        error: "invalid_client",
        error_description:
          "The redirect URI specified by the application does not match any of the " +
          `registered redirect URIs. Erroneous redirect URI: ${client_redirect}`,
      });
      return next();
    }
  } catch (err) {
    logger.error("Failed to retrieve client info from Dynamo DB.", err);
    res.status(400).json({
      error: "invalid_client",
      error_description:
        "The client specified by the application is not valid.",
    });
    return next();
  }
};

module.exports = authorizeHandler;
