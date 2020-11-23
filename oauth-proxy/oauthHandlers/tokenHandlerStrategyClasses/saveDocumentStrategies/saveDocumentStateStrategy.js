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
        let hashedDocument = getHashedDocument(document, tokens, this.config);
        await this.dynamoClient.saveToDynamo(
          this.dynamo,
          hashedDocument.state,
          "refresh_token",
          hashedDocument.refresh_token,
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

const getHashedDocument = async (document, tokens, config) => {
  return {
    state: hashString(document.state.S, config.hmac_secret),
    refresh_token: hashString(tokens.refresh_token, config.hmac_secret),
  };
};
module.exports = { SaveDocumentStateStrategy };
