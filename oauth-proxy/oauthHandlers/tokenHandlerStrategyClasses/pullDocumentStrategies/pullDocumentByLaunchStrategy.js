const { rethrowIfRuntimeError } = require("../../../utils");

class PullDocumentByLaunchStrategy {
  constructor(logger, dynamo, dynamoClient, accessToken, config) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.accessToken = accessToken;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let document;
    let accessToken = getHashedAccessToken(this.accessToken);
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "access_token",
        accessToken,
        this.config.dynamo_client_credentials_table
      );
    } catch (err) {
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }

    return document;
  }
}

const getHashedAccessToken = (accessToken) => {
  return accessToken;
};

module.exports = { PullDocumentByLaunchStrategy };
