const { hashString } = require("../../../utils");

class PullDocumentByRefreshTokenStrategy {
  constructor(req, logger, dynamo, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let hashedRefreshToken = hashString(
      this.req.body.refresh_token,
      this.config.hmac_secret
    );
    let document = await this.getDocumentDynamo(hashedRefreshToken);

    // Backwards compatability.
    // Remove after 42 Days of PR merge (DATE - Fill out before PR).
    if (document == null) {
      this.logger.warn(
        "Hashed Refresh Token not found. Searching for unhashed code."
      );
      document = await this.getDocumentDynamo(this.req.body.refresh_token);
    }
    return document;
  }

  async getDocumentDynamo(refresh_token) {
    let document;
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "refresh_token",
        refresh_token,
        this.config.dynamo_table_name
      );
    } catch (error) {
      this.logger.error("Could not retrieve state from DynamoDB", error);
    }
    return document;
  }
}

module.exports = { PullDocumentByRefreshTokenStrategy };
