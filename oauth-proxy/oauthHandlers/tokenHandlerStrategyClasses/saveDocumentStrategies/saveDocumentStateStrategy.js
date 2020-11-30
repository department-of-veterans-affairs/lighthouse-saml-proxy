const { hashString } = require("../../../utils");

class SaveDocumentStateStrategy {
  constructor(req, logger, dynamo, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.state && tokens.refresh_token) {
        await this.dynamoClient.saveToDynamo(
          this.dynamo,
          document.state.S,
          "refresh_token",
          hashString(tokens.refresh_token, this.config.hmac_secret),
          this.config.dynamo_table_name
        );
      }
    } catch (error) {
      this.logger.error(
        "Could not update the refresh token in DynamoDB",
        error
      );
    }
  }
}

module.exports = { SaveDocumentStateStrategy };
