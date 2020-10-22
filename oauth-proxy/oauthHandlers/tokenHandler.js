const jwtDecode = require("jwt-decode");

const { rethrowIfRuntimeError, parseBasicAuth } = require("../utils");
const { translateTokenSet } = require("./tokenResponse");
const {
  RefreshTokenStrategy,
} = require("./tokenHandlerStrategies/refreshTokenStrategy");
const {
  AccessTokenStrategy,
} = require("./tokenHandlerStrategies/accessTokenStrategy");

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
  let tokenStrategy;

  if (req.body.grant_type === "refresh_token") {
    tokenStrategy = new RefreshTokenStrategy(
      req,
      client,
      logger,
      dynamo,
      dynamoClient
    );
  } else if (req.body.grant_type === "authorization_code") {
    tokenStrategy = new AccessTokenStrategy(
      req,
      client,
      logger,
      dynamo,
      dynamoClient,
      redirect_uri
    );
  } else {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description:
        "Only authorization and refresh_token grant types are supported",
    });
    return next();
  }

  await getTokensObject(tokenStrategy)
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

const getTokensObject = async (tokenStrategy) => {
  let tokens;

  try {
    tokens = await tokenStrategy.getToken();
  } catch (err) {
    let error = tokenStrategy.handleTokenError(err);
    throw error;
  }

  let document = await tokenStrategy.pullDocumentFromDynamo();
  let state;
  if (document && tokens) {
    tokenStrategy.saveDocumentToDynamo(document, tokens);
    state = document.state.S;
  }

  return { tokens: tokens, state: state };
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

module.exports = tokenHandler;
