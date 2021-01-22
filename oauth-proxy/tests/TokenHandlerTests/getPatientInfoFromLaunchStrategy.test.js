const {
  GetPatientInfoFromLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/getPatientInfoStrategies/getPatientInfoFromLaunchStrategy");

require("jest");

describe("createPatientInfo Tests", () => {
  it("Happy Path", async () => {
    let response = await new GetPatientInfoFromLaunchStrategy({
      body: { launch: "launch" },
    }).createPatientInfo();
    expect(response).toBe("launch");
  });
});
