const {
  rethrowIfRuntimeError,
  statusCodeFromError,
} = require("../../../utils");

class AuthorizationCodeStrategy {
  constructor(req, logger, redirect_uri, client) {
    this.req = req;
    this.logger = logger;
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
      let errorOut = { message: error.message}
      if (error.statusCode) {
        errorOut.statusCode = error.statusCode;
      }
      this.logger.error(
        "Failed to retrieve tokens using the OpenID client",
        errorOut
      );
      throw {
        error: error.error,
        error_description: error.error_description,
        statusCode: statusCodeFromError(error),
      };
    }
    return token;
  }
}

module.exports = { AuthorizationCodeStrategy };
