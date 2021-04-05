const { rethrowIfRuntimeError } = require("../utils");
const {
  buildTokenHandlerClient,
} = require("./tokenHandlerStrategyClasses/tokenHandlerClientBuilder");

const tokenHandler = async (
  config,
  redirect_uri,
  logger,
  issuer,
  dynamoClient,
  validateToken,
  staticTokens,
  audience,
  req,
  res,
  next
) => {
  let tokenHandlerClient;
  try {
    tokenHandlerClient = buildTokenHandlerClient(
      redirect_uri,
      issuer,
      logger,
      dynamoClient,
      config,
      req,
      res,
      next,
      validateToken,
      staticTokens,
      audience
    );
  } catch (error) {
    rethrowIfRuntimeError(error);
    res.status(error.status).json({
      error: error.error,
      error_description: error.error_description,
    });
    return next();
  }

  let tokenResponse;
  try {
    tokenResponse = await tokenHandlerClient.handleToken();
  } catch (err) {
    return next(err);
  }
  res.status(tokenResponse.statusCode).json(tokenResponse.responseBody);
  return next();
};

module.exports = tokenHandler;
