const { hashString } = require("../../../utils");

class GetDocumentByRefreshTokenStrategy {
  constructor(req, logger, dynamoClient, config, client_id) {
    this.req = req;
    this.logger = logger;
    this.dynamoClient = dynamoClient;
    this.config = config;

    // Backwards compatibility.
    // Remove after 42 days of PR merge (DATE - 02/23/2021).
    this.client_id = client_id;
  }
  async getDocument() {
    let hashedRefreshToken = hashString(
      this.req.body.refresh_token,
      this.config.hmac_secret
    );
    let document = await this.getDocumentDynamo(
      hashedRefreshToken,
      this.config.dynamo_oauth_requests_table
    );

    return document;
  }

  async getDocumentDynamo(refresh_token, tableName) {
    let document;
    try {
      let payload = await this.dynamoClient.queryFromDynamo(
        {
          refresh_token: refresh_token,
        },
        tableName,
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
