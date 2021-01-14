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
    mockValidate = buildValidateToken({}, true);
    let strategy = new GetPatientInfoFromValidateEndpointStrategy(
      mockValidate,
      logger
    );
    try {
      await strategy.createPatientInfo(null, null);
    } catch (err) {
      expect(true).toBe(true);
      return;
    }
    expect(true).toBe(false);
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
    } catch (err) {
      expect(true).toBe(true);
      expect(err.status).toBe(500);
      expect(logger.error).toHaveBeenCalledWith(
        "Invalid grant, could not find a valid patient identifier for the provided authorization code."
      );
      return;
    }
    expect(true).toBe(false);
  });
});
