require("jest");

const {
  GetDocumentByAccessTokenStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/documentStrategies/getDocumentByAccessTokenStrategy");
const {
  buildFakeDynamoClient,
  buildFakeLogger,
  createFakeConfig,
  createFakeHashingFunction,
} = require("../testUtils");

describe("getDocument Tests", () => {
  let logger = buildFakeLogger();
  let dynamoClient;
  let config = createFakeConfig();
  let hashingFunction = createFakeHashingFunction();

  it("Happy Path", async () => {
    dynamoClient = buildFakeDynamoClient({
      access_token: "access_token",
      launch: "launch",
    });

    let document = await new GetDocumentByAccessTokenStrategy(
      logger,
      dynamoClient,
      config,
      hashingFunction
    ).getDocument("access_token");

    expect(document.access_token).toBe("access_token");
    expect(document.launch).toBe("launch");
  });

  it("Dynamo Client Throws Error Fetching Document By Access Token.", async () => {
    dynamoClient = buildFakeDynamoClient({
      access_token: "access_token",
      launch: "launch",
    });

    let document = await new GetDocumentByAccessTokenStrategy(
      logger,
      dynamoClient,
      config,
      hashingFunction
    ).getDocument("not_access_token");

    expect(document).toBe(undefined);
  });
});
