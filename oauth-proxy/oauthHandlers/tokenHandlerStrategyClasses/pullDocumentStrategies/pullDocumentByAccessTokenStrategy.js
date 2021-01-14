const { rethrowIfRuntimeError } = require("../../../utils");
const dynamoClient = require("../../../dynamo_client");

class PullDocumentByAccessTokenStrategy {
  constructor(logger, dynamo, dynamoClient, config, hashingFunction) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
    this.hashingFunction = hashingFunction;
  }
  async pullDocumentFromDynamo(access_token) {
    let document;
    let hashedToken = this.hashingFunction(
      access_token,
      this.config.hmac_secret
    );
    try {
      let search_params = {
        access_token: hashedToken,
      };
      let payload = await dynamoClient.getPayloadFromDynamo(
        this.dynamo,
        search_params,
        this.config.dynamo_table_name
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

module.exports = { PullDocumentByAccessTokenStrategy };
