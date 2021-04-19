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

  let document;
  try {
    document = await dynamoClient.getPayloadFromDynamo(
      {
        internal_state: state,
      },
      config.dynamo_oauth_requests_table
    );
  } catch (error) {
    logger.error("Failed to look up by internal_state.", error);
  }

  try {
    if (document && document.Item && document.Item.redirect_uri) {
      if (!Object.prototype.hasOwnProperty.call(req.query, "error")) {
        await dynamoClient.updateToDynamo(
          { internal_state: state },
          {
            code: hashString(req.query.code, config.hmac_secret),
            expires_on: Math.round(Date.now() / 1000) + 60 * 10, // 10 minutes
          },
          config.dynamo_oauth_requests_table
        );
      }

      document = document.Item;
      const params = new URLSearchParams(req.query);
      // Rewrite to original state
      params.set("state", document.state);
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
    logger.error("Failed to update DynamoDB with code.", error);
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
