class SaveDocumentLaunchStrategy {
  constructor(logger, dynamo, dynamoClient, config, hashingFunction) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
    this.hashingFunction = hashingFunction;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.launch) {
        let launch = document.launch.S;
        let accessToken = this.hashingFunction(
          tokens.access_token,
          this.config.hmac_secret
        );
        await this.dynamoClient.saveToDynamoAccessToken(
          this.dynamo,
          accessToken,
          "launch",
          launch,
          this.config.dynamo_client_credentials_table
        );
      }
    } catch (error) {
      this.logger.error(
        "Could not update the access token token in DynamoDB",
        error
      );
    }
  }
}

module.exports = { SaveDocumentLaunchStrategy };
