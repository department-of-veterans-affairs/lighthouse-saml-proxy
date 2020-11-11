const { rethrowIfRuntimeError } = require("../../../utils");

class PullDocumentByAccessTokenStrategy {
  constructor(req, logger, dynamo, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let document;
    const token_index = req.header.authorization.indexOf("Bearer") + "Bearer ".length;
    const access_token = req.header.authorization.substr(token_index);
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "access_token",
        access_token,
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
