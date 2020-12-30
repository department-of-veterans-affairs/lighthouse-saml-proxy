const process = require("process");
const {
  rethrowIfRuntimeError,
  statusCodeFromError,
  minimalError,
} = require("../../../utils");
const { oktaTokenRefreshGauge, stopTimer } = require("../../../metrics");
const dynamoClient = require("../../../dynamo_client");

class RefreshTokenStrategy {
  constructor(req, logger, client, dynamo, config) {
    this.req = req;
    this.logger = logger;
    this.client = client;
    this.dynamo = dynamo;
    this.config = config;
  }

  //will throw error if cannot retrieve refresh token
  async getTokenResponse() {
    let oktaTokenRefreshStart = process.hrtime.bigint();
    let tokens = await this.getIfStaticToken(this.req.body.refresh_token);
    if (!tokens || !tokens.access_token) {
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
    }
    return tokens;
  }

  async getIfStaticToken(refresh_token) {
    let search_params = {
      static_refresh_token: refresh_token,
    };
    let tokens;
    try {
      let payload = await dynamoClient.getPayloadFromDynamo(
        this.dynamo,
        search_params,
        this.config.dynamo_static_token_table
      );
      if (payload.Item) {
        payload = payload.Item;
        if (payload.static_access_token) {
          tokens = {
            access_token: payload.static_access_token,
            refresh_token: payload.static_refresh_token,
          };
          if (payload.static_expires_in) {
            tokens.expires_in = payload.static_expires_in;
          }
          if (payload.static_icn) {
            tokens.patient = payload.static_icn;
          }
          if (payload.static_id_token) {
            tokens.id_token = payload.static_id_token;
          }
          tokens.token_type = payload.static_token_type
            ? payload.static_token_type
            : "bearer";
          if (payload.static_redirect_uri) {
            tokens.redirect_uri = payload.static_redirect_uri;
          }
          if (payload.static_code) {
            tokens.code = payload.static_code;
          }
          if (payload.static_state) {
            tokens.state = payload.statc_state;
          }
        }
      }
    } catch (error) {
      this.logger.error("Could not retrieve state from DynamoDB", error);
    }
    return tokens;
  }
}

module.exports = { RefreshTokenStrategy };
