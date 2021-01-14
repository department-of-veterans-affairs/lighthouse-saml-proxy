const {
  GetDocumentByLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/documentStrategies/getDocumentByLaunchStrategy");

require("jest");

describe("getDocumentByLaunchStrategy tests", () => {
  it("undefined launch", async () => {
    const req = {
      body: {},
    };

    const strategy = new GetDocumentByLaunchStrategy(req);

    const document = await strategy.getDocument();
    expect(document).toBe(null);
  });

  it("empty launch", async () => {
    const req = {
      body: {
        launch: "",
      },
    };

    const strategy = new GetDocumentByLaunchStrategy(req);

    const document = await strategy.getDocument();
    expect(document).toBe(null);
  });

  it("non-empty launch", async () => {
    const req = {
      body: {
        launch: "42",
      },
    };

    const strategy = new GetDocumentByLaunchStrategy(req);

    const document = await strategy.getDocument();
    expect(document.launch.S).toBe("42");
  });
});
