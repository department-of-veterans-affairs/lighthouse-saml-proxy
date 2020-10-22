export class AccessTokenStrategy {
  constructor(req,
    client,
    logger,
    dynamo,
    dynamoClient,
    redirect_uri) {
      this.req = req;
      this.client = client;
      this.logger = logger;
      this.dynamo = dynamo;
      this.dynamoClient = dynamoClient;
      this.redirect_uri = redirect_uri;
    }


  //will throw error if cannot retrieve refresh token
  async getToken() {
    return await client.grant({ ...req.body, redirect_uri });
  }

  handleTokenError() {
    rethrowIfRuntimeError(error);
    logger.error("Failed to retrieve tokens using the OpenID client", error);
    const statusCode = statusCodeFromError(error);
    return {
      statusCode: statusCode,
      error: error.error,
      error_description: error.error_description,
    };
  }

  async pullDocumentFromDynamo() {
    const document;
    try {
      document = await dynamoClient.getFromDynamoBySecondary(
        dynamo,
        "code",
        req.body.code
      );
    } catch(err) {
      logger.error("Failed to retrieve document from Dynamo DB.", error);
    }

    return document;
  }

  async saveDocumentToDynamo(document, tokens) {
    try {
      let state = document.state.S;
      if (tokens.refresh_token) {
        await dynamoClient.saveToDynamo(
          dynamo,
          state,
          "refresh_token",
          tokens.refresh_token
        );
      }
    } catch (error) {
      rethrowIfRuntimeError(error);
      logger.error("Failed to save the new refresh token to DynamoDB", error);
      document.state.S = null;
    }
  } 
}