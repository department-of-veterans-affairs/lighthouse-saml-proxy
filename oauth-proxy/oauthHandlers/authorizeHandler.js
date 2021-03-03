const { URLSearchParams, URL } = require("url");
const { loginBegin } = require("../metrics");
const { v4: uuidv4 } = require("uuid");

const authorizeHandler = async (
  redirect_uri,
  logger,
  issuer,
  dynamoClient,
  oktaClient,
  slugHelper,
  app_category,
  dynamo_oauth_requests_table,
  dynamo_clients_table,
  idp,
  req,
  res,
  next
) => {
  loginBegin.inc();
  const { state, client_id, aud, redirect_uri: client_redirect } = req.query;

  let missingParameters = await checkParameters(
    state,
    aud,
    issuer,
    logger,
    oktaClient,
    client_redirect
  );

  if (missingParameters) {
    res.status(missingParameters.status).json({
      error: missingParameters.error,
      error_description: missingParameters.error_description,
    });
    return next();
  }

  let validationError = await validateClient(
    logger,
    client_id,
    client_redirect,
    dynamoClient,
    dynamo_clients_table,
    oktaClient,
    app_category
  );

  if (validationError) {
    res.status(validationError.status).json({
      error: validationError.error,
      error_description: validationError.error_description,
    });
    return next();
  }

  let internal_state = uuidv4();
  try {
    let authorizePayload = {
      internal_state: internal_state,
      state: state,
      redirect_uri: client_redirect,
      expires_on: Math.round(Date.now() / 1000) + 60 * 10, // 10 minutes
    };

    // If the launch scope is included then also
    // save the launch context provided (if any)
    if (
      req.query.scope &&
      req.query.scope.split(" ").includes("launch") &&
      req.query.launch
    ) {
      authorizePayload.launch = req.query.launch;
    }

    await dynamoClient.savePayloadToDynamo(
      authorizePayload,
      dynamo_oauth_requests_table
    );
  } catch (error) {
    logger.error(
      `Failed to save client redirect URI ${client_redirect} in authorize handler`
    );
    return next(error); // This error is unrecoverable because we can't create a record to lookup the requested redirect
  }

  const params = new URLSearchParams(req.query);
  params.set("redirect_uri", redirect_uri);
  // Rewrite to an internally maintained state
  params.set("state", internal_state);
  if (params.has("idp")) {
    params.set("idp", slugHelper.rewrite(params.get("idp")));
  } else if (!params.has("idp") && idp) {
    params.set("idp", idp);
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
    return {
      status: 400,
      error: "invalid_client",
      error_description:
        "There was no redirect URI specified by the application.",
    };
  }
  if (!state) {
    logger.error("No valid state parameter was found.");
    return {
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
  return null;
};

const validateClient = async (
  logger,
  client_id,
  client_redirect,
  dynamoClient,
  dynamo_clients_table,
  oktaClient,
  app_category
) => {
  if (app_category.client_store && app_category.client_store === "local") {
    return await localValidateClient(
      logger,
      client_id,
      client_redirect,
      dynamoClient,
      dynamo_clients_table
    );
  }

  return await serverValidateClient(
    oktaClient,
    logger,
    client_id,
    client_redirect
  );
};

const localValidateClient = async (
  logger,
  client_id,
  client_redirect,
  dynamoClient,
  dynamo_clients_table
) => {
  try {
    let clientInfo = await dynamoClient.getPayloadFromDynamo(
      {
        client_id: client_id,
      },
      dynamo_clients_table
    );
    if (clientInfo.Item) {
      clientInfo = clientInfo.Item;
    } else {
      return {
        status: 400,
        error: "invalid_client",
        error_description:
          "The client specified by the application is not valid.",
      };
    }
    if (!clientInfo.redirect_uris.values.includes(client_redirect)) {
      return {
        status: 400,
        error: "invalid_client",
        error_description:
          "The redirect URI specified by the application does not match any of the " +
          `registered redirect URIs. Erroneous redirect URI: ${client_redirect}`,
      };
    }
  } catch (err) {
    logger.error("Failed to retrieve client info from Dynamo DB.", err);
    return {
      status: 400,
      error: "invalid_client",
      error_description:
        "The client specified by the application is not valid.",
    };
  }
};

const serverValidateClient = async (
  oktaClient,
  logger,
  client_id,
  client_redirect
) => {
  let oktaApp;
  try {
    oktaApp = await oktaClient.getApplication(client_id);
  } catch (error) {
    // This error is unrecoverable because we would be unable to verify
    // that we are redirecting to a whitelisted client url
    logger.error(
      "Unrecoverable error: could not get the Okta client app",
      error
    );

    return {
      status: 400,
      error: "invalid_client",
      error_description:
        "The client specified by the application is not valid.",
    };
  }
  if (
    oktaApp.settings.oauthClient.redirect_uris.indexOf(client_redirect) === -1
  ) {
    return {
      status: 400,
      error: "invalid_client",
      error_description:
        "The redirect URI specified by the application does not match any of the " +
        `registered redirect URIs. Erroneous redirect URI: ${client_redirect}`,
    };
  }
};

module.exports = authorizeHandler;
