const { URLSearchParams } = require("url");
const { loginEnd } = require("../metrics");

const redirectHandler = async (
  logger,
  dynamo,
  dynamoClient,
  config,
  req,
  res,
  next
) => {
  const { state } = req.query;

  if (state == null) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "State parameter required",
    });
    return next();
  }

  if (!Object.prototype.hasOwnProperty.call(req.query, "error")) {
    try {
      await dynamoClient.saveToDynamo(
        dynamo,
        state,
        "code",
        req.query.code,
        config.dynamo_table_name
      );
    } catch (error) {
      logger.error(
        "Failed to save authorization code in redirect handler",
        error
      );
    }
  }
  try {
    const document = await dynamoClient.getFromDynamoByState(
      dynamo,
      state,
      config.dynamo_table_name
    );
    const params = new URLSearchParams(req.query);
    loginEnd.inc();
    res.redirect(`${document.redirect_uri.S}?${params.toString()}`);
  } catch (error) {
    logger.error("Failed to redirect to the OAuth client application", error);
    return next(error); // This error is unrecoverable because we can't look up the original redirect.
  }
};

module.exports = redirectHandler;
