const { rethrowIfRuntimeError } = require("../utils");
const {
  LaunchRequestHandlerClient,
} = require("./tokenHandlerStrategyClasses/launchRequestHandlerClient")

const launchRequestHandler = async (
  config,
  logger,
  dynamo,
  dynamoClient,
  req,
  res,
  next
) => {
  
  let launch;
  try {
    let launchRequestHandlerClient = new LaunchRequestHandlerClient(
      config,
      logger,
      dynamo,
      dynamoClient,
      req,
      res,
      next,
    );
    launch = await launchRequestHandlerClient.handleRequest();
  } catch (err) {
    return next(err);
  }
  res.status(200).json(launch);
  return next();
};

module.exports = launchRequestHandler;
