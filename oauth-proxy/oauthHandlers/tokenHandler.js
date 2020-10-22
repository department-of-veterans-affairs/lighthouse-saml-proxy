const {
  RefreshTokenStrategy,
} = require("./tokenHandlerStrategies/refreshTokenStrategy");
const {
  AccessTokenStrategy,
} = require("./tokenHandlerStrategies/accessTokenStrategy");

const {
  TokenHandlerClient,
} = require("./tokenHandlerStrategies/tokenHandlerClient");

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
  let tokenStrategy;
  try {
    tokenStrategy = getTokenStrategy(
      redirect_uri,
      logger,
      dynamo,
      dynamoClient,
      req
    );
  } catch (error) {
    res.status(error.statusCode).json({
      error: error.error,
      error_description: error.error_description,
    });
  }

  let tokenHandlerClient = new TokenHandlerClient(
    tokenStrategy,
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
    res.status(err.statusCode).json({
      error: err.error,
      error_description: err.error_description,
    });
    return next(err);
  }
  res.json(tokenResponse);
  return next();
};

const getTokenStrategy = (redirect_uri, logger, dynamo, dynamoClient, req) => {
  let tokenStrategy;
  if (req.body.grant_type === "refresh_token") {
    tokenStrategy = new RefreshTokenStrategy(req, logger, dynamo, dynamoClient);
  } else if (req.body.grant_type === "authorization_code") {
    tokenStrategy = new AccessTokenStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      redirect_uri
    );
  } else {
    throw {
      statusCode: 400,
      error: "unsupported_grant_type",
      error_description:
        "Only authorization and refresh_token grant types are supported",
    };
  }
  return tokenStrategy;
};

module.exports = tokenHandler;
