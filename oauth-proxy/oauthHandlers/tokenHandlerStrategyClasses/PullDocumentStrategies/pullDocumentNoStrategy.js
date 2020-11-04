//This class will be deleted when API-3017 is complete.
class PullDocumentNoStrategy {
  constructor(req, logger, dynamo, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    return null;
  }
}

module.exports = { PullDocumentNoStrategy };