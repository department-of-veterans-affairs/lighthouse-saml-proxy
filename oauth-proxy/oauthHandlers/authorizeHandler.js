const { URLSearchParams, URL } = require("url");
const { loginBegin } = require("../metrics");

const authorizeHandler = async (
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
) => {
  loginBegin.inc();
  const { state, client_id, aud, redirect_uri: client_redirect } = req.query;

  try {
    await checkParameters(state, aud, issuer, logger, oktaClient);
  } catch (err) {
    res.status(err.status).json({
      error: err.error,
      error_description: err.error_description,
    });
    return next();
  }

  try {
    const oktaApp = await oktaClient.getApplication(client_id);
    if (
      oktaApp.settings.oauthClient.redirect_uris.indexOf(client_redirect) === -1
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

  try {
    await dynamoClient.saveToDynamo(
      dynamo,
      state,
      "redirect_uri",
      client_redirect,
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
  if (!params.has("idp") && config.idp) {
    params.set("idp", config.idp);
  }

  res.redirect(
    `${issuer.metadata.authorization_endpoint}?${params.toString()}`
  );
};

const checkParameters = async (state, aud, issuer, logger, oktaClient) => {
  if (!state) {
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
        throw { status: 500, error: "internal_error" };
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

module.exports = authorizeHandler;
