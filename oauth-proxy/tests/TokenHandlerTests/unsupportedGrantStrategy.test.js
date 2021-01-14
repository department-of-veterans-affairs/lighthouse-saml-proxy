const {
  UnsupportedGrantStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/unsupportedGrantStrategy");

require("jest");

describe("getToken tests", () => {
  it("Happy Path", () => {
    let error = {
      statusCode: 400,
      error: "unsupported_grant_type",
      error_description:
        "Only authorization and refresh_token grant types are supported",
    };

    try {
      new UnsupportedGrantStrategy().getToken();
    } catch (err) {
      expect(err).toEqual(error);
      return;
    }
    expect(true).toBe(false);
  });
});
