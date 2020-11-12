const { rethrowIfRuntimeError } = require("../../../utils");

class PullDocumentByAccessTokenStrategy {
  constructor(logger, dynamo, dynamoClient, config) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async pullDocumentFromDynamo(access_token) {
    let document;
    let hashedToken = this.hashingFunction(
      access_token,
      this.config.hmac_secret
    );
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "access_token",
        hashedToken,
        this.config.dynamo_client_credentials_table
      );
    } catch (err) {
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }

    return document;
  }
}

module.exports = { PullDocumentByAccessTokenStrategy };
