const { hashString } = require("../../../utils");

class PullDocumentByRefreshTokenStrategy {
  constructor(req, logger, dynamo, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let hashedRefreshToken = hashString(
      this.req.body.refresh_token,
      this.config.hmac_secret
    );
    let document = await this.getDocumentDynamo(hashedRefreshToken);

    // Backwards compatibility.
    // Remove after 42 Days of PR merge (DATE - 11/30/2020).
    if (document == null) {
      this.logger.warn(
        "Hashed refresh_token not found. Searching for unhashed refresh_token."
      );
      document = await this.getDocumentDynamo(this.req.body.refresh_token);
    }
    return document;
  }

  async getDocumentDynamo(refresh_token) {
    let document = this.getIfStaticToken(refresh_token);
    if (!document.access_token) {
      try {
        document = await this.dynamoClient.getFromDynamoBySecondary(
          this.dynamo,
          "refresh_token",
          refresh_token,
          this.config.dynamo_table_name
        );
      } catch (error) {
        this.logger.error("Could not retrieve state from DynamoDB", error);
      }
    }
    return document;
  }

  async getIfStaticToken(refresh_token) {
    let search_params = {
      static_refresh_token: refresh_token,
    };
    let document;
    try {
      let payload = await this.dynamoClient.getPayloadFromDynamo(
        this.dynamo,
        search_params,
        this.config.dynamo_static_token_table
      );
      if (payload.static_access_token) {
        document.access_token = { S: payload.static_access_token };
        document.refresh_token = { S: payload.static_refresh_token };
        if (payload.static_id_token) {
          document.id_token = { S: payload.static_id_token };
        }
        document.token_type = payload.static_token_type
          ? { S: payload.static_token_type }
          : { S: "bearer" };
        document.redirect_uri = { S: payload.static_redirect_uri };
        if (payload.static_code) {
          document.code = { S: payload.static_code };
        }
        if (payload.static_state) {
          document.state = { S: payload.statc_state };
        }
        if (payload.static_expires_in) {
          document.expires_in = { N: payload.static_expires_in };
        }
      }
    } catch (error) {
      this.logger.error("Could not retrieve state from DynamoDB", error);
    }
    return document;
  }
}

module.exports = { PullDocumentByRefreshTokenStrategy };
