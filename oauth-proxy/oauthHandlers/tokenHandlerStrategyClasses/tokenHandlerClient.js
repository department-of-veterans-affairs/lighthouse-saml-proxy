const jwtDecode = require("jwt-decode");
const { rethrowIfRuntimeError } = require("../../utils");
const { translateTokenSet } = require("../tokenResponse");

class TokenHandlerClient {
  constructor(
    getTokenResponseStrategy,
    pullDocumentFromDynamoStrategy,
    saveDocumentToDynamoStrategy,
    getPatientInfoStrategy,
    req,
    res,
    next
  ) {
    this.getTokenResponseStrategy = getTokenResponseStrategy;
    this.pullDocumentFromDynamoStrategy = pullDocumentFromDynamoStrategy;
    this.saveDocumentToDynamoStrategy = saveDocumentToDynamoStrategy;
    this.getPatientInfoStrategy = getPatientInfoStrategy;
    this.req = req;
    this.res = res;
    this.next = next;
  }
  async handleToken() {
    let tokens;
    try {
      tokens = await this.getTokenResponseStrategy.getTokenResponse();
    } catch (error) {
      rethrowIfRuntimeError(error);
      if (error.statusCode !== undefined && error.statusCode === 401) {
        return {
          statusCode: 401,
          responseBody: {
            error: "invalid_client",
            error_description: "Invalid value for client_id parameter.",
          },
        };
      }
      return {
        statusCode: error.statusCode,
        responseBody: {
          error: error.error,
          error_description: error.error_description,
        },
      };
    }

    if (tokens.is_static) {
      delete tokens.is_static;
      return {
        statusCode: 200,
        responseBody: tokens,
      };
    }

    let document = await this.pullDocumentFromDynamoStrategy.pullDocumentFromDynamo();
    let state;
    if (document && tokens) {
      await this.saveDocumentToDynamoStrategy.saveDocumentToDynamo(
        document,
        tokens
      );
      state = (document.state && document.state.S) || null;
    }
    state = state || null;

    //Creates a Token Response
    const tokenResponseBase = translateTokenSet(tokens);
    let decoded = jwtDecode(tokens.access_token);
    if (decoded.scp != null && decoded.scp.indexOf("launch/patient") > -1) {
      let patient = await this.getPatientInfoStrategy.createPatientInfo(
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
