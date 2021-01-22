require("jest");
const {
  buildFakeDynamoClient,
  buildFakeLogger,
  createFakeConfig,
} = require("../testUtils");
const MockExpressRequest = require("mock-express-request");
const {
  SaveDocumentStateStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/saveDocumentStrategies/saveDocumentStateStrategy");

const HMAC_SECRET = "secret";
const STATE = "abc123";
const CODE_HASH_PAIR = [
  "the_fake_authorization_code",
  "9daf298b2cb68502791f6f264aef8ebb56dc0ddd3542fbd1c4bd675538fd9cb8",
];
const REFRESH_TOKEN_HASH_PAIR = [
  "the_fake_refresh_token",
  "9b4dba523ad0a7e323452871556d691787cd90c6fe959b040c5864979db5e337",
];
const REDIRECT_URI = "http://localhost/thisDoesNotMatter";

const ACCESS_TOKEN = "the_fake_access_token";

let dynamoClient;
let config;
let dynamo;
let logger;
let req;
let document;
let tokens;

describe("saveDocumentStateStrategy tests", () => {
  beforeEach(() => {
    config = createFakeConfig();
    config.hmac_secret = HMAC_SECRET;
    dynamo = jest.mock();
    logger = buildFakeLogger();
    req = new MockExpressRequest({
      body: {
        code: CODE_HASH_PAIR[0],
      },
    });
    document = {
      state: { S: STATE },
      code: { S: CODE_HASH_PAIR[0] },
      refresh_token: { S: REFRESH_TOKEN_HASH_PAIR[0] },
      redirect_uri: { S: REDIRECT_URI },
    };
    tokens = {
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      access_token: ACCESS_TOKEN,
    };
  });

  it("Happy Path", () => {
    dynamoClient = buildFakeDynamoClient({
      state: STATE,
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI,
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("No Document State", () => {
    document.state = null;
    dynamoClient = buildFakeDynamoClient({
      state: STATE,
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI,
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).not.toHaveBeenCalled();
    expect(dynamoClient.saveToDynamo).not.toHaveBeenCalled();
  });
  it("Could not save documents", () => {
    dynamoClient = jest.fn();
    dynamoClient.mockImplementation(() => {
      throw new Error("Test Error");
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).toHaveBeenCalled();
  });
});
