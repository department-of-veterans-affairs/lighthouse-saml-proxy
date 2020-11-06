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

    let document = {
        launch: {
          S: launch,
        },
      };
    

    return document;
  }
}

module.exports = { PullDocumentByLaunchStrategy };