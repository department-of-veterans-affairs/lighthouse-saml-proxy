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
    let document = await this.getDocumentDynamo(hashedCode);

    // Backwards compatibility.
    // Remove after 42 Days of PR merge (DATE - 11/30/2020).
    if (!document) {
      this.logger.warn("Hashed code not found. Searching for unhashed code.");
      document = await this.getDocumentDynamo(this.req.body.code);
    }
    return document;
  }

  async getDocumentDynamo(code) {
    let document;

    try {
      let payload = await this.dynamoClient.queryFromDynamo(
        {
          code: code,
        },
        this.config.dynamo_table_name,
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
