const { rethrowIfRuntimeError, parseBasicAuth } = require("../utils");
const {
  RefreshTokenStrategy,
} = require("./tokenHandlerStrategyClasses/refreshTokenStrategy");
const {
  AuthorizationCodeStrategy,
} = require("./tokenHandlerStrategyClasses/authorizationCodeStrategy");
const {
  UnsupportedGrantStrategy,
} = require("./tokenHandlerStrategyClasses/unsupportedGrantStrategy");
const {
  TokenHandlerClient,
} = require("./tokenHandlerStrategyClasses/tokenHandlerClient");

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
  let tokenHandlerStrategy;
  try {
    tokenHandlerStrategy = getTokenStrategy(
      redirect_uri,
      issuer,
      logger,
      dynamo,
      dynamoClient,
      config,
      req
    );
  } catch (error) {
    rethrowIfRuntimeError(error);
    res.status(error.status).json({
      error: error.error,
      error_description: error.error_description,
    });
    return next();
  }

  let tokenHandlerClient = new TokenHandlerClient(
    tokenHandlerStrategy,
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
  );

  let tokenResponse;
  try {
    tokenResponse = await tokenHandlerClient.handleToken();
  } catch (err) {
    return next(err);
  }
  res.status(tokenResponse.statusCode).json(tokenResponse.responseBody);
  return next();
};

function createClientMetadata(redirect_uri, req, config) {
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
}

const getClient = (issuer, redirect_uri, req, config) => {
  let clientMetadata;
  try {
    clientMetadata = createClientMetadata(redirect_uri, req, config);
  } catch (error) {
    rethrowIfRuntimeError(error);
    throw {
      status: 401,
      error: error.error,
      error_description: error.error_description,
    };
  }

  return new issuer.Client(clientMetadata);
};
const getTokenStrategy = (
  redirect_uri,
  issuer,
  logger,
  dynamo,
  dynamoClient,
  config,
  req
) => {
  let tokenHandlerStrategy;
  if (req.body.grant_type === "refresh_token") {
    tokenHandlerStrategy = new RefreshTokenStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      getClient(issuer, redirect_uri, req, config)
    );
  } else if (req.body.grant_type === "authorization_code") {
    tokenHandlerStrategy = new AuthorizationCodeStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      redirect_uri,
      getClient(issuer, redirect_uri, req, config)
    );
  } else {
    tokenHandlerStrategy = new UnsupportedGrantStrategy();
  }
  return tokenHandlerStrategy;
};

module.exports = tokenHandler;
