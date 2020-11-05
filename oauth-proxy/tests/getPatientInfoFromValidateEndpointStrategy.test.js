require("jest");

const {
  GetPatientInfoFromValidateEndpointStrategy,
} = require("../oauthHandlers/tokenHandlerStrategyClasses/getPatientInfoStrategies/getPatientInfoFromValidateEndpointStrategy");

describe("getPatientInfoFromValidateEndpointStrategy tests", () => {
  let logger;
  let mockValidate;

  beforeEach(() => {
    logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  });
  it("Type Error", async () => {
    mockValidate = {
      validateToken: async () => {
        throw {};
      },
    };
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
    mockValidate = async () => {
      throw {};
    };
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
      return;
    }
    expect(true).toBe(false);
  });
});
