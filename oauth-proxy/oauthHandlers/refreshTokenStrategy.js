const { oktaTokenRefreshGauge, stopTimer } = require("../metrics");

export class RefreshTokenStrategy {
  constructor(req, client, logger, dynamo, dynamoClient) {
    this.req = req;
    this.client = client;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
  }

  //will throw error if cannot retrieve refresh token
  async getToken() {
    const oktaTokenRefreshStart = process.hrtime.bigint();
    let tokens = await client.refresh(req.body.refresh_token);
    stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
    return tokens;
  }

  handleTokenError() {
    rethrowIfRuntimeError(error);
    logger.error(
      "Could not refresh the client session with the provided refresh token",
      error
    );
    stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
    const statusCode = statusCodeFromError(error);
    return {
      statusCode: statusCode,
      error: error.error,
      error_description: error.error_description,
    }
  }

  async pullDocumentFromDynamo() {
    let document;
    try {
      document = await dynamoClient.getFromDynamoBySecondary(
        dynamo,
        "refresh_token",
        req.body.refresh_token
      );
    } catch (error) {
      logger.error("Could not retrieve state from DynamoDB", error);
    }
  }

  async saveDocumentToDynamo(document, tokens) {
    try {
      state = document.state.S;
      await dynamoClient.saveToDynamo(
        dynamo,
        state,
        "refresh_token",
        tokens.refresh_token
      );
    } catch (error) {
      logger.error("Could not update the refresh token in DynamoDB", error);
    }
  }
}