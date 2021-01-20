const { rethrowIfRuntimeError } = require("../../../utils");

class GetDocumentByAccessTokenStrategy {
  constructor(logger, dynamoClient, config, hashingFunction) {
    this.logger = logger;
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
      let payload = await this.dynamoClient.getPayloadFromDynamo(
        {
          access_token: hashedToken,
        },
        this.config.dynamo_client_credentials_table
      );
      if (payload.Item) {
        document = payload.Item;
      }
    } catch (err) {
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }

    return document;
  }
}

module.exports = { GetDocumentByAccessTokenStrategy };
