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
  let dynamo = jest.fn();
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
      dynamo,
      dynamoClient,
      config,
      hashingFunction
    ).getDocument("access_token");

    expect(document.access_token.S).toBe("access_token");
    expect(document.launch.S).toBe("launch");
  });

  it("Dynamo Client Throws Error Fetching Document By Access Token.", async () => {
    dynamoClient = buildFakeDynamoClient({
      access_token: "access_token",
      launch: "launch",
    });

    let document = await new GetDocumentByAccessTokenStrategy(
      logger,
      dynamo,
      dynamoClient,
      config,
      hashingFunction
    ).getDocument("not_access_token");

    expect(document).toBe(undefined);
  });
});
