const process = require("process");
const {
  rethrowIfRuntimeError,
  statusCodeFromError,
  minimalError,
} = require("../../../utils");
const { oktaTokenRefreshGauge, stopTimer } = require("../../../metrics");

class RefreshTokenStrategy {
  constructor(req, logger, client) {
    this.req = req;
    this.logger = logger;
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
        minimalError(error)
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
}

module.exports = { RefreshTokenStrategy };
