const { hashString } = require("../utils");

/**
 * Handler for retrieving select claims for a token.
 */
const claimsHandler = async (config, logger, dynamoClient, req, res, next) => {
  let document;

  /*
   * If request does not contain a token, respond with a 400.
   */
  if (!req.body.token) {
    return res.status(400).json({
      error: "invalid_request",
      error_description: "Missing parameter: token",
    });
  }

  /*
   * Lookup token and claims using hash.
   */
  try {
    const documents = await dynamoClient.queryFromDynamo(
      {
        access_token: hashString(req.body.token, config.hmac_secret),
      },
      config.dynamo_oauth_requests_table,
      "oauth_access_token_index"
    );

    if (documents.Items && documents.Items[0]) {
      document = documents.Items[0];
    }
  } catch (error) {
    /*
     * If data can't be queried, log the error and bail.
     */
    logger.error("Error retrieving token claims", error);
    return next(error);
  }

  /*
   * If token is not found or is missing iss, respond with a 403.
   */
  if (!document || !document.iss) {
    return res.sendStatus(403);
  }

  res.json({ iss: document.iss });

  return next();
};

module.exports = claimsHandler;
