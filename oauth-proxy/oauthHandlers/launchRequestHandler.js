const { rethrowIfRuntimeError } = require("../utils");
const {
  PullDocumentByAccessTokenStrategy,
} = require("./pullDocumentStrategies/pullDocumentByAccessTokenStrategy");



const tokenHandler = async (
  config,
  logger,
  dynamo,
  dynamoClient,
  req,
  res,
  next
) => {
  const pullDocumentByAccessTokenStrategy = new PullDocumentByAccessTokenStrategy(
    logger,
    dynamo,
    dynamoClient,
    config
  );
  
  const token_index = req.header.authorization.indexOf("Bearer") + "Bearer ".length;
  const access_token = req.header.authorization.substr(token_index);

  let launch;
  try {
    launch = await pullDocumentByAccessTokenStrategy.pullDocumentFromDynamo(access_token);
  } catch (err) {
    return next(err);
  }
  res.status(200).json(launch);
  return next();
};

module.exports = tokenHandler;
