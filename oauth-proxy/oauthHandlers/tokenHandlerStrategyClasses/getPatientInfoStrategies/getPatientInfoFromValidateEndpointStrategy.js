const { rethrowIfRuntimeError } = require("../../../utils");
class GetPatientInfoFromValidateEndpointStrategy {
  constructor(validateToken, logger, audience) {
    this.logger = logger;
    this.validateToken = validateToken;
    this.audience = audience;
  }
  async createPatientInfo(tokens) {
    let patient;
    try {
      const validation_result = await this.validateToken(
        tokens.access_token,
        this.audience
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
      this.logger.error(
        "Invalid grant, could not find a valid patient identifier for the provided authorization code."
      );
      throw {
        statusCode: 503,
      };
    }
    return patient;
  }
}

module.exports = { GetPatientInfoFromValidateEndpointStrategy };
