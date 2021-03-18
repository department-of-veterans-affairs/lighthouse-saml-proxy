const {
  SaveDocumentLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/saveDocumentStrategies/saveDocumentLaunchStrategy");
const { buildToken } = require("./tokenHandlerTestUtils");
const {
  buildFakeDynamoClient,
  buildFakeLogger,
  createFakeConfig,
  createFakeHashingFunction,
  jwtEncodeClaims,
  convertObjectToDynamoAttributeValues,
} = require("../testUtils");

require("jest");

describe("saveDocumentToDynamo tests", () => {
  let logger = buildFakeLogger();
  let dynamoClient;
  let config = createFakeConfig();
  let hashingFunction = createFakeHashingFunction();

  it("Empty Tokens", async () => {
    let token = buildToken(false, false);
    let document = convertObjectToDynamoAttributeValues({
      access_token: token,
      launch: "launch",
    });
    dynamoClient = buildFakeDynamoClient(document);

    const strategy = new SaveDocumentLaunchStrategy(
      logger,
      dynamoClient,
      config,
      hashingFunction
    );
    await strategy.saveDocumentToDynamo(document, null);

    expect(logger.error.mock.calls).toHaveLength(1);
  });

  it("Empty Document Launch", async () => {
    let token = buildToken(false, false);
    token.launch = "launch";

    let document = convertObjectToDynamoAttributeValues({
      access_token: token,
    });
    dynamoClient = buildFakeDynamoClient(document);

    const strategy = new SaveDocumentLaunchStrategy(
      logger,
      dynamoClient,
      config,
      hashingFunction
    );

    await strategy.saveDocumentToDynamo(document, token);
    expect(dynamoClient.savePayloadToDynamo).not.toHaveBeenCalled();
    expect(logger.error.mock.calls).toHaveLength(0);
  });

  it("happy path", async () => {
    let token = buildToken(false, false);
    token.launch = "launch";

    let document = convertObjectToDynamoAttributeValues({
      access_token: token,
      launch: "launch",
    });
    dynamoClient = buildFakeDynamoClient(document);

    const strategy = new SaveDocumentLaunchStrategy(
      logger,
      dynamoClient,
      config,
      hashingFunction
    );

    await strategy.saveDocumentToDynamo(document, token);
    expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalledWith(
      {
        access_token:
          "8ce1212e7c1ce218f9fc5daf75d918eaa18feb06507d096f5bb9d6846b02e98c",
        expires_on: 5678,
        launch: {
          S: "launch",
        },
      },
      "LaunchContext"
    );
    expect(logger.error.mock.calls).toHaveLength(0);
  });
});
