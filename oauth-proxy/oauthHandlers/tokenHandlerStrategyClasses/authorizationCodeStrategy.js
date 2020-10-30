const { rethrowIfRuntimeError, statusCodeFromError } = require("../../utils");

class AuthorizationCodeStrategy {
  constructor(req, logger, dynamo, dynamoClient, redirect_uri, client) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.redirect_uri = redirect_uri;
    this.client = client;
  }

  //will throw error if cannot retrieve refresh token
  async getTokenResponse() {
    let token;
    try {
      token = await this.client.grant({
        ...this.req.body,
        redirect_uri: this.redirect_uri,
      });
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
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }

    return document;
  }

  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.state && tokens.refresh_token) {
        let state = document.state.S;
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
    }
  }
}

module.exports = { AuthorizationCodeStrategy };
