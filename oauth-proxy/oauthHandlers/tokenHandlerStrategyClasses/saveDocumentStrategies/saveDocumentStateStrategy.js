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
      if (document.state && document.refresh_token) {
        let state = document.state.S;
        await this.dynamoClient.saveToDynamo(
          this.dynamo,
          state,
          "refresh_token",
          tokens.refresh_token,
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
