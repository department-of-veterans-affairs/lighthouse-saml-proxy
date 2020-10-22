const process = require("process");

const { rethrowIfRuntimeError, statusCodeFromError } = require("../../utils");
const { oktaTokenRefreshGauge, stopTimer } = require("../../metrics");

class RefreshTokenStrategy {
  constructor(req, logger, dynamo, dynamoClient) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.oktaTokenRefreshStart;
  }

  //will throw error if cannot retrieve refresh token
  async getToken(client) {
    this.oktaTokenRefreshStart = process.hrtime.bigint();
    let tokens;
    try {
      tokens = await client.refresh(this.req.body.refresh_token);
      stopTimer(oktaTokenRefreshGauge, this.oktaTokenRefreshStart);
    } catch (error) {
      rethrowIfRuntimeError(error);
      this.logger.error(
        "Could not refresh the client session with the provided refresh token",
        error
      );
      stopTimer(oktaTokenRefreshGauge, this.oktaTokenRefreshStart);
      throw {
        statusCode: statusCodeFromError(error),
        error: error.error,
        error_description: error.error_description,
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
