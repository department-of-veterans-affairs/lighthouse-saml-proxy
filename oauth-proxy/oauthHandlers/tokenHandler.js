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
  let clientMetadata;
  try {
    clientMetadata = createClientMetaData(redirect_uri, req, config);
  } catch (err) {
    res.status(401).json(err);
    return next();
  }

  const client = new issuer.Client(clientMetadata);

  let responseObject;

  await getTokensObject(req, client, logger, dynamo, dynamoClient, redirect_uri)
    .then((res) => (responseObject = res))
    .catch((err) => {
      res.status(err.statusCode).json({
        error: err.error,
        error_description: err.error_description,
      });
    });

  if (res.statusCode >= 400) {
    return next();
  }

  let error;

  createTokenResponse(
    responseObject.tokens,
    responseObject.state,
    validateToken,
    logger
  )
    .then((response) => res.json(response))
    .catch((err) => {
      error = {
        error: err.error,
        error_description: err.error_description,
      };
      res.status(err.statusCode).json(error);
    });

  if (error) {
    return next(error);
  }

  return next();
};

const getTokensObject = async (
  req,
  client,
  logger,
  dynamo,
  dynamoClient,
  redirect_uri
) => {
  let tokensObject;
  if (req.body.grant_type === "refresh_token") {
    await refreshTokenHandler(req, client, logger, dynamo, dynamoClient).then(
      (res) => (tokensObject = res)
    );
  } else if (req.body.grant_type === "authorization_code") {
    await authorizationCodeHandler(
      req,
      client,
      logger,
      dynamo,
      dynamoClient,
      redirect_uri
    ).then((res) => (tokensObject = res));
  } else {
    throw {
      statusCode: 400,
      error: "unsupported_grant_type",
      error_description:
        "Only authorization and refresh_token grant types are supported",
    };
  }
  return tokensObject;
};

const createTokenResponse = async (tokens, state, validateToken, logger) => {
  const tokenResponseBase = translateTokenSet(tokens);
  var decoded = jwtDecode(tokens.access_token);
  if (decoded.scp != null && decoded.scp.indexOf("launch/patient") > -1) {
    try {
      const validation_result = await validateToken(
        tokens.access_token,
        decoded.aud
      );
      const patient = validation_result.va_identifiers.icn;
      return { ...tokenResponseBase, patient, state };
    } catch (error) {
      rethrowIfRuntimeError(error);
      logger.error(
        "Could not find a valid patient identifier for the provided authorization code",
        error
      );
      throw {
        statusCode: 400,
        error: "invalid_grant",
        error_description:
          "We were unable to find a valid patient identifier for the provided authorization code.",
      };
    }
  }
  return { ...tokenResponseBase, state };
};

const authorizationCodeHandler = async (
  req,
  client,
  logger,
  dynamo,
  dynamoClient,
  redirect_uri
) => {
  let tokens;
  let state;
  try {
    tokens = await client.grant({ ...req.body, redirect_uri });
  } catch (error) {
    rethrowIfRuntimeError(error);
    logger.error("Failed to retrieve tokens using the OpenID client", error);
    const statusCode = statusCodeFromError(error);
    throw {
      statusCode: statusCode,
      error: error.error,
      error_description: error.error_description,
    };
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
  return { tokens: tokens, state: state };
};

const refreshTokenHandler = async (
  req,
  client,
  logger,
  dynamo,
  dynamoClient
) => {
  let tokens;
  let state;
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
    stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
    const statusCode = statusCodeFromError(error);
    throw {
      statusCode: statusCode,
      error: error.error,
      error_description: error.error_description,
    };
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
  return { tokens: tokens, state: state };
};

const createClientMetaData = (redirect_uri, req, config) => {
  let clientMetadata = {
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
    throw {
      error: "invalid_client",
      error_description: "Client authentication failed",
    };
  }
  return clientMetadata;
};

module.exports = tokenHandler;