const { rethrowIfRuntimeError } = require("../../../utils");

class PullDocumentByAccessCodeStrategy {
  constructor(req, logger, dynamo, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let document;
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "access_token",
        this.req.body.access_token,
        this.config.dynamo_client_credentials_table
      );
    } catch (err) {
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }

    return document;
  }
}

module.exports = { PullDocumentByAccessCodeStrategy };
