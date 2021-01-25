const { URLSearchParams } = require("url");
const { loginEnd } = require("../metrics");
const { hashString } = require("../utils");

const redirectHandler = async (
  logger,
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
      await dynamoClient.updateToDynamo(
        { state: state },
        { code: hashString(req.query.code, config.hmac_secret) },
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
    let document = await dynamoClient.getPayloadFromDynamo(
      {
        state: state,
      },
      config.dynamo_table_name
    );
    if (document && document.Item && document.Item.redirect_uri) {
      document = document.Item;
      const params = new URLSearchParams(req.query);
      loginEnd.inc();
      res.redirect(`${document.redirect_uri}?${params.toString()}`);
    } else {
      logger.error(
        "Failed to get the redirect for the OAuth client application"
      );
      res.status(400).json({
        error: "invalid_request",
        error_description: "Invalid state",
      });
    }
  } catch (error) {
    logger.error("Failed to redirect to the OAuth client application", error);
    // This error is unrecoverable because we can't look up the original redirect.
    res.status(400).json({
      error: "invalid_request",
      error_description: "Invalid state",
    });
  }
  // Only would reach here upon an error
  return next();
};

module.exports = redirectHandler;
