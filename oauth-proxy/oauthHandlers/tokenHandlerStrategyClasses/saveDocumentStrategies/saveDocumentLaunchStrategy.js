const jwtDecode = require("jwt-decode");
const { hashString } = require("../../../utils");

class SaveDocumentLaunchStrategy {
  constructor(logger, dynamoClient, config) {
    this.logger = logger;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.launch) {
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
      this.logger.error(
        "Could not update the access token token in DynamoDB",
        error
      );
    }
  }
}

module.exports = { SaveDocumentLaunchStrategy };
