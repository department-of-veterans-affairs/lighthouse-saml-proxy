const { rethrowIfRuntimeError, hashString } = require("../../../utils");

class PullDocumentByCodeStrategy {
  constructor(req, logger, dynamo, dynamoClient, config) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.config = config;
  }
  async pullDocumentFromDynamo() {
    let hashedCode = hashString(this.req.body.code, this.config.hmac_secret);
    let document = await this.getDocumentDynamo(hashedCode);

    // Backwards compatibility.
    // Remove after 42 Days of PR merge (DATE - 11/30/2020).
    if (document == null) {
      this.logger.warn("Hashed code not found. Searching for unhashed code.");
      document = await this.getDocumentDynamo(this.req.body.code);
    }
    return document;
  }

  async getDocumentDynamo(code) {
    let document;
    try {
      document = await this.dynamoClient.getFromDynamoBySecondary(
        this.dynamo,
        "code",
        code,
        this.config.dynamo_table_name
      );
    } catch (err) {
      rethrowIfRuntimeError(err);
      this.logger.error("Failed to retrieve document from Dynamo DB.", err);
    }
    return document;
  }
}

module.exports = { PullDocumentByCodeStrategy };
