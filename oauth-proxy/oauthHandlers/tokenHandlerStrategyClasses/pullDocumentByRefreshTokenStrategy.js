class PullDocumentByRefreshTokenStrategy {
  constructor(req, logger, dynamo, dynamoClient) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
  }
  async pullDocumentFromDynamo() {
    let document;
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "refresh_token",
        this.req.body.refresh_token
      );
    } catch (error) {
      this.logger.error("Could not retrieve state from DynamoDB", error);
    }
    return document;
  }
}

module.exports = { PullDocumentByRefreshTokenStrategy };
