require("jest");

const {
  GetPatientInfoFromValidateEndpointStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/getPatientInfoStrategies/getPatientInfoFromValidateEndpointStrategy");
const { buildFakeLogger } = require("../testUtils");
const { buildValidateToken } = require("./tokenHandlerTestUtils");
describe("getPatientInfoFromValidateEndpointStrategy tests", () => {
  let logger;
  let mockValidate;

  beforeEach(() => {
    logger = buildFakeLogger();
  });
  it("Happy Path", async () => {
    mockValidate = buildValidateToken(
      { va_identifiers: { icn: "patient" } },
      false
    );
    let strategy = new GetPatientInfoFromValidateEndpointStrategy(
      mockValidate,
      logger
    );
    let response = await strategy.createPatientInfo(
      { access_token: "token" },
      { aud: "aud" }
    );
    expect(response).toBe("patient");
  });
  it("Type Error", async () => {
    let error = { response: { status: 500 } };
    mockValidate = buildValidateToken(error, true);
    let strategy = new GetPatientInfoFromValidateEndpointStrategy(
      mockValidate,
      logger
    );
    try {
      await strategy.createPatientInfo(
        { access_token: "token" },
        { aud: "aud" }
      );
      fail("Type error should have been thrown.");
    } catch (err) {
      expect(logger.error).toHaveBeenCalledWith({
        message: "Server returned status code " + error.response.status,
      });
      return;
    }
  });

  it("Validate error", async () => {
    mockValidate = buildValidateToken({}, true);
    let strategy = new GetPatientInfoFromValidateEndpointStrategy(
      mockValidate,
      logger
    );
    try {
      await strategy.createPatientInfo(
        { access_token: "token" },
        { aud: "aud" }
      );
      fail("Validate error should have been thrown.");
    } catch (err) {
      expect(err.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        "Invalid grant, could not find a valid patient identifier for the provided authorization code."
      );
      return;
    }
  });
});
