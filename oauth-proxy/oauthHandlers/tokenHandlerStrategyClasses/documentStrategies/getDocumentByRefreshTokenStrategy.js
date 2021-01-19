const { hashString } = require("../../../utils");

class GetDocumentByRefreshTokenStrategy {
  constructor(req, logger, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async getDocument() {
    let hashedRefreshToken = hashString(
      this.req.body.refresh_token,
      this.config.hmac_secret
    );
    let document = await this.getDocumentDynamo(hashedRefreshToken);

    // Backwards compatibility.
    // Remove after 42 Days of PR merge (DATE - 11/30/2020).
    if (!document) {
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
      let payload = await this.dynamoClient.queryFromDynamo(
        {
          refresh_token: refresh_token,
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

module.exports = { GetDocumentByRefreshTokenStrategy };
