const jwtDecode = require("jwt-decode");
const { rethrowIfRuntimeError } = require("../../utils");
const { translateTokenSet } = require("../tokenResponse");

class TokenHandlerClient {
  constructor(
    tokenHandlerStrategy,
    config,
    redirect_uri,
    logger,
    issuer,
    dynamo,
    dynamoClient,
    validateToken,
    req,
    res,
    next
  ) {
    this.tokenHandlerStrategy = tokenHandlerStrategy;
    this.config = config;
    this.redirect_uri = redirect_uri;
    this.logger = logger;
    this.issuer = issuer;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.validateToken = validateToken;
    this.req = req;
    this.res = res;
    this.next = next;
  }
  async handleToken() {
    let tokens;
    try {
      tokens = await this.tokenHandlerStrategy.getTokenResponse();
    } catch (error) {
      rethrowIfRuntimeError(error);
      return {
        statusCode: error.statusCode,
        responseBody: {
          error: error.error,
          error_description: error.error_description,
        },
      };
    }

    let document = await this.tokenHandlerStrategy.pullDocumentFromDynamo();
    let state;
    if (document && tokens) {
      await this.tokenHandlerStrategy.saveDocumentToDynamo(document, tokens);
      state = (document.state && document.state.S) || null;
    }
    state = state || null;

    //Creates a Token Response
    const tokenResponseBase = translateTokenSet(tokens);
    let decoded = jwtDecode(tokens.access_token);
    if (decoded.scp != null && decoded.scp.indexOf("launch/patient") > -1) {
      let patient = await this.tokenHandlerStrategy.createPatientInfo(
        tokens,
        decoded
      );
      return {
        statusCode: 200,
        responseBody: { ...tokenResponseBase, patient, state },
      };
    }
    return { statusCode: 200, responseBody: { ...tokenResponseBase, state } };
  }
}

module.exports = { TokenHandlerClient };
