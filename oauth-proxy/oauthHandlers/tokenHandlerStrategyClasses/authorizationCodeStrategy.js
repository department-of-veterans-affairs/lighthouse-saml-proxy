const { rethrowIfRuntimeError, statusCodeFromError } = require("../../utils");

class AuthorizationCodeStrategy {
  constructor(req, logger, dynamo, dynamoClient) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
  }

  //will throw error if cannot retrieve refresh token
  async getTokenResponse(client, redirect_uri) {
    let token;
    try {
      token = await client.grant({ ...this.req.body, redirect_uri });
    } catch (error) {
      rethrowIfRuntimeError(error);
      this.logger.error(
        "Failed to retrieve tokens using the OpenID client",
        error
      );
      throw {
        error: error.error,
        error_description: error.error_description,
        statusCode: statusCodeFromError(error),
      };
    }
    return token;
  }

  async pullDocumentFromDynamo() {
    let document;
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "code",
        this.req.body.code
      );
    } catch (err) {
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }

    return document;
  }

  async saveDocumentToDynamo(document, tokens) {
    try {
      let state = document.state.S;
      if (tokens.refresh_token) {
        await this.dynamoClient.saveToDynamo(
          this.dynamo,
          state,
          "refresh_token",
          tokens.refresh_token
        );
      }
    } catch (error) {
      rethrowIfRuntimeError(error);
      this.logger.error(
        "Failed to save the new refresh token to DynamoDB",
        error
      );
      document.state.S = null;
    }
  }
}

module.exports = { AuthorizationCodeStrategy };
