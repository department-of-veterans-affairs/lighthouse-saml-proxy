const { hashString } = require("../../../utils");
const jwtDecode = require("jwt-decode");
const { v4: uuidv4 } = require("uuid");

class SaveDocumentStateStrategy {
  constructor(req, logger, dynamoClient, config, issuer) {
    this.req = req;
    this.logger = logger;
    this.dynamoClient = dynamoClient;
    this.config = config;
    this.issuer = issuer;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.state && tokens.access_token) {
        if (document.internal_state) {
          let updated_document = {
            access_token: hashString(
              tokens.access_token,
              this.config.hmac_secret
            ),
            iss: this.issuer,
          };

          if (tokens.refresh_token) {
            updated_document.refresh_token = hashString(
              tokens.refresh_token,
              this.config.hmac_secret
            );
            updated_document.expires_on =
              Math.round(Date.now() / 1000) + 60 * 60 * 24 * 42;
          } else {
            updated_document.expires_on = tokens.expires_at;
          }

          await this.dynamoClient.updateToDynamo(
            { internal_state: document.internal_state },
            updated_document,
            this.config.dynamo_oauth_requests_table
          );
        } else {
          // Backwards compatibility.
          // Remove after 42 day of PR merge (DATE - 02/23/2021).
          let payload = {
            internal_state: uuidv4(),
            state: document.state,
            redirect_uri: document.redirect_uri,
            access_token: hashString(
              tokens.access_token,
              this.config.hmac_secret
            ),
            iss: this.issuer,
            refresh_token: hashString(
              tokens.refresh_token,
              this.config.hmac_secret
            ),
            expires_on: Math.round(Date.now() / 1000) + 60 * 60 * 24 * 42,
          };

          if (document.launch) {
            payload.launch = document.launch;
          }
          await this.dynamoClient.savePayloadToDynamo(
            payload,
            this.config.dynamo_oauth_requests_table
          );
        }
      }
    } catch (error) {
      this.logger.error(
        "Could not update the refresh token in DynamoDB",
        error
      );
    }

    try {
      if (document.launch && tokens.access_token) {
        let decodedToken = jwtDecode(tokens.access_token);
        if (decodedToken.scp.includes("launch")) {
          let launch = document.launch;
          let accessToken = hashString(
            tokens.access_token,
            this.config.hmac_secret
          );

          let payload = {
            access_token: accessToken,
            launch: launch,
            expires_on: decodedToken.exp,
          };

          await this.dynamoClient.savePayloadToDynamo(
            payload,
            this.config.dynamo_launch_context_table
          );
        } else {
          this.logger.warn("Launch context specified but scope not granted.");
        }
      }
    } catch (error) {
      this.logger.error("Could not save the launch context in DynamoDB", error);
      throw {
        status: 500,
        errorMessage: "Could not save the launch context.",
      };
    }
  }
}

module.exports = { SaveDocumentStateStrategy };
