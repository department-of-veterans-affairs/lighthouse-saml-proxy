const {
  LaunchRequestHandlerClient,
} = require("./tokenHandlerStrategyClasses/launchRequestHandlerClient");

const launchRequestHandler = async (
  config,
  logger,
  dynamo,
  dynamoClient,
  req,
  res,
  next
) => {
  let launchResp;
  let statusCode;
  let responseBody;
  try {
    let launchRequestHandlerClient = new LaunchRequestHandlerClient(
      config,
      logger,
      dynamo,
      dynamoClient,
      req,
      res,
      next
    );
    launchResp = await launchRequestHandlerClient.handleRequest();
    statusCode = launchResp.statusCode;
    responseBody = launchResp.responseBody;
  } catch (err) {
    if (err.statusCode || err.message.includes("tokens")) {
      statusCode = err.statusCode ? err.statusCode : 401;
      responseBody = err;
    } else {
      logger.error(err);
      return next(err);
    }
  }
  res.status(statusCode).json(responseBody);
  return next();
};

module.exports = launchRequestHandler;
