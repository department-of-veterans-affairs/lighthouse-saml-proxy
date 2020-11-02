class SaveDocumentStateStrategy {
  constructor(req, logger, dynamo, dynamoClient) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.state) {
        let state = document.state.S;
        await this.dynamoClient.saveToDynamo(
          this.dynamo,
          state,
          "refresh_token",
          tokens.refresh_token
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
