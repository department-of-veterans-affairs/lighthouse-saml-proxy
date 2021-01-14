const { hashString } = require("../utils");
const {
  GetDocumentByAccessTokenStrategy,
} = require("./tokenHandlerStrategyClasses/documentStrategies/getDocumentByAccessTokenStrategy");

/*
 * Handler for looking up SMART launch context by access_token.
 */
const launchRequestHandler = async (
  config,
  logger,
  dynamo,
  dynamoClient,
  res,
  next
) => {
  const getDocumentStrategy = new GetDocumentByAccessTokenStrategy(
    logger,
    dynamo,
    dynamoClient,
    config,
    hashString
  );

  let documentResponse = await getDocumentStrategy.getDocument(res.locals.jwt);

  if (documentResponse && documentResponse.launch) {
    res.json({ launch: documentResponse.launch.S });
  } else {
    return res.sendStatus(401);
  }

  return next();
};

module.exports = launchRequestHandler;
