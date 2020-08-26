const jwtDecode = require("jwt-decode");
const process = require("process");

const {
  rethrowIfRuntimeError,
  statusCodeFromError,
  parseBasicAuth,
} = require("../utils");
const { translateTokenSet } = require("./tokenResponse");
const { oktaTokenRefreshGauge, stopTimer } = require("../metrics");

const tokenHandler = async (
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
) => {
  const clientMetadata = {
    redirect_uris: [redirect_uri],
  };

  const basicAuth = parseBasicAuth(req);
  if (basicAuth) {
    clientMetadata.client_id = basicAuth.username;
    clientMetadata.client_secret = basicAuth.password;
  } else if (req.body.client_id && req.body.client_secret) {
    clientMetadata.client_id = req.body.client_id;
    clientMetadata.client_secret = req.body.client_secret;
    delete req.body.client_id;
    delete req.body.client_secret;
  } else if (config.enable_pkce_authorization_flow && req.body.client_id) {
    clientMetadata.token_endpoint_auth_method = "none";
    clientMetadata.client_id = req.body.client_id;
    delete req.body.client_id;
  } else {
    res.status(401).json({
      error: "invalid_client",
      error_description: "Client authentication failed",
    });
    return next();
  }

  const client = new issuer.Client(clientMetadata);

  let tokens, state;
  if (req.body.grant_type === "refresh_token") {
    const oktaTokenRefreshStart = process.hrtime.bigint();
    try {
      tokens = await client.refresh(req.body.refresh_token);
      stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
    } catch (error) {
      rethrowIfRuntimeError(error);
      logger.error(
        "Could not refresh the client session with the provided refresh token",
        error
      );
      const statusCode = statusCodeFromError(error);
      res.status(statusCode).json({
        error: error.error,
        error_description: error.error_description,
      });
      stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
      return next();
    }
    let document;
    try {
      document = await dynamoClient.getFromDynamoBySecondary(
        dynamo,
        "refresh_token",
        req.body.refresh_token
      );
    } catch (error) {
      logger.error("Could not retrieve state from DynamoDB", error);
    }

    if (document && document.state) {
      try {
        state = document.state.S;
        await dynamoClient.saveToDynamo(
          dynamo,
          state,
          "refresh_token",
          tokens.refresh_token
        );
      } catch (error) {
        logger.error("Could not update the refresh token in DynamoDB", error);
      }
    }
    // Set state to null if we were unable to retrieve it for any reason.
    // Token response will not include a state value, but ONLY Apple cares
    // about this: it's not actually part of the SMART on FHIR spec.
    state = state || null;
  } else if (req.body.grant_type === "authorization_code") {
    try {
      tokens = await client.grant({ ...req.body, redirect_uri });
    } catch (error) {
      rethrowIfRuntimeError(error);
      logger.error("Failed to retrieve tokens using the OpenID client", error);
      const statusCode = statusCodeFromError(error);
      res.status(statusCode).json({
        error: error.error,
        error_description: error.error_description,
      });
      return next();
    }
    try {
      const document = await dynamoClient.getFromDynamoBySecondary(
        dynamo,
        "code",
        req.body.code
      );
      state = document.state.S;
      if (tokens.refresh_token) {
        await dynamoClient.saveToDynamo(
          dynamo,
          state,
          "refresh_token",
          tokens.refresh_token
        );
      }
    } catch (error) {
      rethrowIfRuntimeError(error);
      logger.error("Failed to save the new refresh token to DynamoDB", error);
      state = null;
    }
  } else {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description:
        "Only authorization and refresh_token grant types are supported",
    });
    return next();
  }
  const tokenResponseBase = translateTokenSet(tokens);
  var decoded = jwtDecode(tokens.access_token);
  if (decoded.scp != null && decoded.scp.indexOf("launch/patient") > -1) {
    try {
      const validation_result = await validateToken(
        tokens.access_token,
        decoded.aud
      );
      const patient = validation_result.va_identifiers.icn;
      res.json({ ...tokenResponseBase, patient, state });
      return next();
    } catch (error) {
      rethrowIfRuntimeError(error);
      logger.error(
        "Could not find a valid patient identifier for the provided authorization code",
        error
      );
      res.status(400).json({
        error: "invalid_grant",
        error_description:
          "We were unable to find a valid patient identifier for the provided authorization code.",
      });
      return next(error);
    }
  } else {
    res.json({ ...tokenResponseBase, state });
    return next();
  }
};

module.exports = tokenHandler;
