const { hashString } = require("../../utils");
const jwtDecode = require("jwt-decode");
const { rethrowIfRuntimeError } = require("../../utils");
const { translateTokenSet } = require("../tokenResponse");
const { PullDocumentByAccessTokenStrategy } = require("./pullDocumentStrategies/pullDocumentByAccessTokenStrategy");
const createError = require('http-errors')

class LaunchRequestHandlerClient {
  constructor(
    config,
    logger,
    dynamo,
    dynamoClient,
    req,
    res,
    next
  ) {
    this.pullDocumentFromDynamoStrategy = new PullDocumentByAccessTokenStrategy(
      logger,
      dynamo,
      dynamoClient,
      config,
      hashString
    );
    this.req = req;
    this.res = res;
    this.next = next;
  }
  async handleRequest() {
    if (!this.req.headers.authorization) {
      let error = createError(401, "Authorization required");
      error.statusCode = 401;
      throw error;
    }
    const token_index = this.req.headers.authorization.indexOf("Bearer") + "Bearer ".length;
    const access_token = this.req.headers.authorization.substr(token_index);
  
    let documentResponse = await this.pullDocumentFromDynamoStrategy.pullDocumentFromDynamo(access_token);
    res.status(documentResponse.statusCode).json(documentResponse.responseBody);
    return { statusCode: 200, responseBody: { launch: document.launch.S }};
  }
}

module.exports = { LaunchRequestHandlerClient };
