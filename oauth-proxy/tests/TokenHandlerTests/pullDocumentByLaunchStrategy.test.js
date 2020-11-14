const {
  PullDocumentByLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/pullDocumentStrategies/pullDocumentByLaunchStrategy");

require("jest");

describe("pullDocumentByLaunchStrategy tests", () => {
  it("undefined launch", async () => {
    const req = {
      body: {},
    };

    const strategy = new PullDocumentByLaunchStrategy(req);

    const document = await strategy.pullDocumentFromDynamo();
    expect(document).toBe(null);
  });

  it("empty launch", async () => {
    const req = {
      body: {
        launch: "",
      },
    };

    const strategy = new PullDocumentByLaunchStrategy(req);

    const document = await strategy.pullDocumentFromDynamo();
    expect(document).toBe(null);
  });

  it("non-empty launch", async () => {
    const req = {
      body: {
        launch: "42",
      },
    };

    const strategy = new PullDocumentByLaunchStrategy(req);

    const document = await strategy.pullDocumentFromDynamo();
    expect(document.launch.S).toBe("42");
  });
});
