class SaveDocumentLaunchStrategy {
  constructor(logger, dynamo, dynamoClient, config, hashingFunction, assert_info) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
    this.hashingFunction = hashingFunction;
    this.assert_info = assert_info;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.launch) {
        let launch = document.launch.S;
        let accessToken = this.hashingFunction(
          tokens.access_token,
          this.config.hmac_secret
        );

        if (this.assert_info && this.assert_info.decodedJwt) {
          this.token_expires_on = this.assert_info.decodedJwt.exp;
        }

        await this.dynamoClient.saveToDynamoAccessToken(
          this.dynamo,
          accessToken,
          "launch",
          launch,
          this.config.dynamo_client_credentials_table,
          this.token_expires_on
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
