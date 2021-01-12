const process = require("process");
const {
  rethrowIfRuntimeError,
  statusCodeFromError,
  minimalError,
} = require("../../../utils");
const { oktaTokenRefreshGauge, stopTimer } = require("../../../metrics");
const dynamoClient = require("../../../dynamo_client");

class RefreshTokenStrategy {
  constructor(req, logger, client, dynamo, config, staticTokens) {
    this.req = req;
    this.logger = logger;
    this.client = client;
    this.dynamo = dynamo;
    this.config = config;
    this.staticTokens = staticTokens;
  }

  //will throw error if cannot retrieve refresh token
  async getTokenResponse() {
    let oktaTokenRefreshStart = process.hrtime.bigint();
    let tokens;

    if (this.config.enable_static_token_service) {
      try {
        if (this.staticTokens.size == 0) {
          let payload;
          payload = await dynamoClient.scanFromDynamo(
            this.dynamo,
            this.config.dynamo_static_token_table
          );
          var self = this;
          payload.Items.forEach(function (staticToken) {
            self.staticTokens.set(
              staticToken.static_refresh_token,
              staticToken
            );
          });
        }
      } catch (err) {
        this.logger.error(
          "Could not load static tokens list",
          minimalError(err)
        );
      }

      if (this.staticTokens.has(this.req.body.refresh_token)) {
        let staticToken = this.staticTokens.get(this.req.body.refresh_token);
        tokens = {
          is_static: true,
          access_token: staticToken.static_access_token,
          refresh_token: staticToken.static_refresh_token,
          token_type: "Bearer",
          scope: staticToken.static_scopes,
          expires_in: staticToken.static_expires_in,
        };
        if (staticToken.static_id_token) {
          tokens.id_token = staticToken.static_id_token;
        }
        if (staticToken.static_icn) {
          tokens.patient = staticToken.static_icn;
        }
        return tokens;
      }
    }

    if (!tokens) {
      try {
        tokens = await this.client.refresh(this.req.body.refresh_token);
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
    }
    stopTimer(oktaTokenRefreshGauge, oktaTokenRefreshStart);
    return tokens;
  }
}

module.exports = { RefreshTokenStrategy };
