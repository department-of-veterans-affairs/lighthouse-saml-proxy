const {
  GetPatientInfoFromLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/getPatientInfoStrategies/getPatientInfoFromLaunchStrategy");

require("jest");

describe("createPatientInfo Tests", () => {
  it("Happy Path", () => {
    let response = new GetPatientInfoFromLaunchStrategy({
      body: { launch: "launch" },
    });
    expect(response).toBe("launch");
  });
});
