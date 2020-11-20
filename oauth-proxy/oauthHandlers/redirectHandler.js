const { URLSearchParams } = require("url");
const { loginEnd } = require("../metrics");
const { hashString } = require("../utils");

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
        hashString(state, config.hmac_secret),
        "code",
        hashString(req.query.code, config.hmac_secret),
        config.dynamo_table_name
      );
    } catch (error) {
      logger.error(
        "Failed to save authorization code in redirect handler",
        error
      );
    }
  }
  let document;
  try {
    document = await dynamoClient.getFromDynamoByState(
      dynamo,
      hashString(state, config.hmac_secret),
      config.dynamo_table_name
    );
  } catch {
    console.log(
      "Could not fetch hashed token. Will attempt to fetch unhashed token."
    );
  }
  try {
    // Backwards compatability.
    // Remove after 42 Days of PR merge (DATE - Fill out before PR).
    if (document == null) {
      document = await dynamoClient.getFromDynamoByState(
        dynamo,
        state,
        config.dynamo_table_name
      );
    }
    const params = new URLSearchParams(req.query);
    loginEnd.inc();
    res.redirect(`${document.redirect_uri.S}?${params.toString()}`);
  } catch (error) {
    logger.error("Failed to redirect to the OAuth client application", error);
    return next(error); // This error is unrecoverable because we can't look up the original redirect.
  }
};

module.exports = redirectHandler;
