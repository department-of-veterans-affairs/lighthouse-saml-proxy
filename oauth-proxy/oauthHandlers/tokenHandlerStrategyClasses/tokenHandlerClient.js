const jwtDecode = require("jwt-decode");
const { rethrowIfRuntimeError } = require("../../utils");
const { translateTokenSet } = require("../tokenResponse");

class TokenHandlerClient {
  constructor(
    getTokenResponseStrategy,
    pullDocumentFromDynamoStrategy,
    saveDocumentToDynamoStrategy,
    validateToken,
    req,
    res,
    next
  ) {
    this.getTokenResponseStrategy = getTokenResponseStrategy;
    this.pullDocumentFromDynamoStrategy = pullDocumentFromDynamoStrategy;
    this.saveDocumentToDynamoStrategy = saveDocumentToDynamoStrategy;
    this.validateToken = validateToken;
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
      return {
        statusCode: error.statusCode,
        responseBody: {
          error: error.error,
          error_description: error.error_description,
        },
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
      let patient = await this.createPatientInfo(tokens, decoded);
      return {
        statusCode: 200,
        responseBody: { ...tokenResponseBase, patient, state },
      };
    }
    return { statusCode: 200, responseBody: { ...tokenResponseBase, state } };
  }

  async createPatientInfo(tokens, decoded) {
    let patient;
    try {
      const validation_result = await this.validateToken(
        tokens.access_token,
        decoded.aud
      );
      patient = validation_result.va_identifiers.icn;
    } catch (error) {
      rethrowIfRuntimeError(error);
      if (error.response) {
        this.logger.error({
          message: "Server returned status code " + error.response.status,
        });
      } else {
        this.logger.error({ message: error.message });
      }
      throw {
        error: "invalid_grant",
        error_description:
          "Could not find a valid patient identifier for the provided authorization code.",
      };
    }
    return patient;
  }
}

module.exports = { TokenHandlerClient };
