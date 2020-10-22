const process = require("process");

const { rethrowIfRuntimeError, statusCodeFromError } = require("../../utils");
const { oktaTokenRefreshGauge, stopTimer } = require("../../metrics");

class RefreshTokenStrategy {
  constructor(req, client, logger, dynamo, dynamoClient) {
    this.req = req;
    this.client = client;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.oktaTokenRefreshStart;
  }

  //will throw error if cannot retrieve refresh token
  async getToken() {
    this.oktaTokenRefreshStart = process.hrtime.bigint();
    let tokens = await this.client.refresh(this.req.body.refresh_token);
    stopTimer(oktaTokenRefreshGauge, this.oktaTokenRefreshStart);
    return tokens;
  }

  handleTokenError(error) {
    rethrowIfRuntimeError(error);
    this.logger.error(
      "Could not refresh the client session with the provided refresh token",
      error
    );
    stopTimer(oktaTokenRefreshGauge, this.oktaTokenRefreshStart);
    const statusCode = statusCodeFromError(error);
    return {
      statusCode: statusCode,
      error: error.error,
      error_description: error.error_description,
    };
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

  async saveDocumentToDynamo(document, tokens) {
    try {
      let state = document.state.S;
      await this.dynamoClient.saveToDynamo(
        this.dynamo,
        state,
        "refresh_token",
        tokens.refresh_token
      );
    } catch (error) {
      this.logger.error(
        "Could not update the refresh token in DynamoDB",
        error
      );
    }
  }
}

module.exports = { RefreshTokenStrategy };
