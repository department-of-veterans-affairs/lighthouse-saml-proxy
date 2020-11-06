const crypto = require('crypto');
class SaveDocumentLaunchStrategy {
  constructor(logger, dynamo, dynamoClient, config) {
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async saveDocumentToDynamo(document, tokens) {
    try {
      if (document.launch) {
        let launch = document.launch.S;
        let accessToken = hashAccessToken(tokens.access_token, this.config.hmac_secret);
        await this.dynamoClient.saveToDynamoLaunch(
          this.dynamo,
          launch,
          "access_token",
          accessToken,
          this.config.dynamo_client_credentials_table
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

const hashAccessToken = (accessToken, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  let hashedAccessToken = hmac.update(accessToken).digest('hex');
  return hashedAccessToken;
};

module.exports = { SaveDocumentLaunchStrategy };
