const { hashString } = require("../../../utils");

class PullDocumentByRefreshTokenStrategy {
  constructor(req, logger, dynamo, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let hashedRefreshToken = hashString(
      this.req.body.refresh_token,
      this.config.hmac_secret
    );
    let document = await this.getDocumentDynamo(hashedRefreshToken);

    // Backwards compatibility.
    // Remove after 42 Days of PR merge (DATE - 11/30/2020).
    if (document == null) {
      this.logger.warn(
        "Hashed refresh_token not found. Searching for unhashed refresh_token."
      );
      document = await this.getDocumentDynamo(this.req.body.refresh_token);
    }
    return document;
  }

  async getDocumentDynamo(refresh_token) {
    let document;
    try {
      let payload = await this.dynamo.queryFromDynamo(
        this.dynamo,
        "#refresh_token = :refresh_token",
        {
          "#refresh_token": "refresh_token",
        },
        {
          ":refresh_token": refresh_token,
        },
        this.config.dynamo_table_name,
        "oauth_refresh_token_index"
      );
      if (payload.Items && payload.Items[0]) {
        document = payload.Items[0];
      }
    } catch (error) {
      this.logger.error("Could not retrieve state from DynamoDB", error);
    }
    return document;
  }
}

module.exports = { PullDocumentByRefreshTokenStrategy };
