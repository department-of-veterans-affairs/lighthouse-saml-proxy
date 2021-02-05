const { hashString } = require("../../../utils");
const jwtDecode = require("jwt-decode");

class SaveDocumentStateStrategy {
  constructor(req, logger, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.state && tokens.refresh_token) {
        await this.dynamoClient.updateToDynamo(
          { state: document.state },
          {
            refresh_token: hashString(
              tokens.refresh_token,
              this.config.hmac_secret
            ),
          },
          this.config.dynamo_table_name
        );
      }
    } catch (error) {
      this.logger.error(
        "Could not update the refresh token in DynamoDB",
        error
      );
    }

    try {
      if (document.launch && tokens.access_token) {
        let launch = document.launch;
        let accessToken = hashString(
          tokens.access_token,
          this.config.hmac_secret
        );

        let decodedToken = jwtDecode(tokens.access_token);
        let payload = {
          access_token: accessToken,
          launch: launch,
          expires_on: decodedToken.exp,
        };

        await this.dynamoClient.savePayloadToDynamo(
          payload,
          this.config.dynamo_launch_context_table
        );
      }
    } catch (error) {
      this.logger.error("Could not save the launch context in DynamoDB", error);
    }
  }
}

module.exports = { SaveDocumentStateStrategy };
