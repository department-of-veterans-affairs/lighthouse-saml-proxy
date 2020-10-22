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
  let tokenHandlerStrategy = getTokenStrategy(
    redirect_uri,
    logger,
    dynamo,
    dynamoClient,
    req
  );

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
    let statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: err.error,
      error_description: err.error_description,
    });
    return next();
  }
  res.json(tokenResponse);
  return next();
};

const getTokenStrategy = (redirect_uri, logger, dynamo, dynamoClient, req) => {
  let tokenHandlerStrategy;
  if (req.body.grant_type === "refresh_token") {
    tokenHandlerStrategy = new RefreshTokenStrategy(
      req,
      logger,
      dynamo,
      dynamoClient
    );
  } else if (req.body.grant_type === "authorization_code") {
    tokenHandlerStrategy = new AuthorizationCodeStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      redirect_uri
    );
  } else {
    tokenHandlerStrategy = new UnsupportedGrantStrategy();
  }
  return tokenHandlerStrategy;
};

module.exports = tokenHandler;
