const { rethrowIfRuntimeError, hashString } = require("../../../utils");

class GetDocumentByCodeStrategy {
  constructor(req, logger, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async getDocument() {
    let hashedCode = hashString(this.req.body.code, this.config.hmac_secret);
    let document = await this.getDocumentDynamo(
      hashedCode,
      this.config.dynamo_oauth_requests_table
    );

    return document;
  }

  async getDocumentDynamo(code, tableName) {
    let document;

    try {
      let payload = await this.dynamoClient.queryFromDynamo(
        {
          code: code,
        },
        tableName,
        "oauth_code_index"
      );
      if (payload.Items && payload.Items[0]) {
        document = payload.Items[0];
      }
    } catch (err) {
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }
    return document;
  }
}

module.exports = { GetDocumentByCodeStrategy };
