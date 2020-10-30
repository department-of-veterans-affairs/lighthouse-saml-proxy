const process = require("process");
const { rethrowIfRuntimeError, statusCodeFromError } = require("../../utils");
const { oktaTokenRefreshGauge, stopTimer } = require("../../metrics");

class RefreshTokenStrategy {
  constructor(req, logger, dynamo, dynamoClient, client) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.client = client;
  }

  //will throw error if cannot retrieve refresh token
  async getTokenResponse() {
    let oktaTokenRefreshStart = process.hrtime.bigint();
    let tokens;
    try {
      tokens = await this.client.refresh(this.req.body.refresh_token);
      stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
    } catch (error) {
      rethrowIfRuntimeError(error);
      this.logger.error(
        "Could not refresh the client session with the provided refresh token",
        error
      );
      stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
      throw {
        error: error.error,
        error_description: error.error_description,
        statusCode: statusCodeFromError(error),
      };
    }

    return tokens;
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
      if (document.state) {
        let state = document.state.S;
        await this.dynamoClient.saveToDynamo(
          this.dynamo,
          state,
          "refresh_token",
          tokens.refresh_token
        );
      }
    } catch (error) {
      this.logger.error(
        "Could not update the refresh token in DynamoDB",
        error
      );
    }
  }
}

module.exports = { RefreshTokenStrategy };
