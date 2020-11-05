const { rethrowIfRuntimeError } = require("../../../utils");

class PullDocumentByLaunchStrategy {
  constructor(logger, dynamo, dynamoClient, req, config) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.req = req;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let launch = this.req.body.launch;
    if (launch == null || launch === undefined || launch === "") {
      return null;
    }

    let document;
    try {
      document = await this.dynamoClient.getFromDynamoByLaunch(
        this.dynamo,
        launch,
        this.config.dynamo_client_credentials_table
      );
    } catch (err) {
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }

    if (document == null || document === undefined) {
      document = {
        launch: {
          S: launch,
        },
      };
    }

    return document;
  }
}

module.exports = { PullDocumentByLaunchStrategy };
