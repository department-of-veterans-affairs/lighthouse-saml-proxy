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
  convertObjectToDynamoAttributeValues
} = require("../testUtils");

require("jest");

describe("saveDocumentToDynamo tests", () => {
  let logger = buildFakeLogger();
  let dynamo = jest.fn();
  let dynamoClient;
  let config = createFakeConfig();
  let hashingFunction = createFakeHashingFunction();

  it("empty launch", async () => {
    let token = buildToken(false, false);
    let document = convertObjectToDynamoAttributeValues({
      access_token: token,
      launch: "launch",
    });
    dynamoClient = buildFakeDynamoClient(document);

    const strategy = new SaveDocumentLaunchStrategy(
      logger, dynamo, dynamoClient, config, hashingFunction
    );
    await strategy.saveDocumentToDynamo(document, null);

    expect(logger.error.mock.calls.length).toBe(1)
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
      logger, dynamo, dynamoClient, config, hashingFunction
    );
    const expire_on = new Date().getTime() + 300 * 1000;
    let encoded_token = jwtEncodeClaims(token,expire_on);
    await strategy.saveDocumentToDynamo(document, {access_token: encoded_token});

    expect(logger.error.mock.calls.length).toBe(0)
  });
});
