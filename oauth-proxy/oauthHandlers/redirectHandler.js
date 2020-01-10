const { URLSearchParams } = require('url');
const { loginEnd } = require('../metrics');

const redirectHandler = async (logger, dynamo, dynamoClient, req, res, next) => {
  const { state } = req.query;
  if (!req.query.hasOwnProperty('error')) {
    try {
      await dynamoClient.saveToDynamo(dynamo, state, "code", req.query.code);
    } catch (error) {
      logger.error(`Failed to save authorization code in redirect handler`, error);
    }
  }
  try {
    const document = await dynamoClient.getFromDynamoByState(dynamo, state);
    const params = new URLSearchParams(req.query);
    loginEnd.inc();
    res.redirect(`${document.redirect_uri.S}?${params.toString()}`)
  } catch (error) {
    logger.error("Failed to redirect to the OAuth client application", error);
    return next(error); // This error is unrecoverable because we can't look up the original redirect.
  }
};

module.exports = redirectHandler;
