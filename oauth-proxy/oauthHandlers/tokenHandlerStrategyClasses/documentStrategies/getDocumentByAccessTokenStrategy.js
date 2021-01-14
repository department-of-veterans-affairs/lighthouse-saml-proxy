const { rethrowIfRuntimeError } = require("../../../utils");

class GetDocumentByAccessTokenStrategy {
  constructor(logger, dynamo, dynamoClient, config, hashingFunction) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
    this.hashingFunction = hashingFunction;
  }
  async getDocument(access_token) {
    let document;
    let hashedToken = this.hashingFunction(
      access_token,
      this.config.hmac_secret
    );
    try {
      document = await this.dynamoClient.getFromDynamoByAccessToken(
        this.dynamo,
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

module.exports = { GetDocumentByAccessTokenStrategy };
