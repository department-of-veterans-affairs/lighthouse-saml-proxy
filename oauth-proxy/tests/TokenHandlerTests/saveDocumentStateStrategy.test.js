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
const LAUNCH = "1234V5678";
const CODE_HASH_PAIR = [
  "the_fake_authorization_code",
  "9daf298b2cb68502791f6f264aef8ebb56dc0ddd3542fbd1c4bd675538fd9cb8",
];
const REFRESH_TOKEN_HASH_PAIR = [
  "the_fake_refresh_token",
  "9b4dba523ad0a7e323452871556d691787cd90c6fe959b040c5864979db5e337",
];
const REDIRECT_URI = "http://localhost/thisDoesNotMatter";

const ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjpbImxhdW5jaCJdLCJpYXQiOjE1MTYyMzkwMjJ9.61N3OfyoslutHtsG1PxVWztr77PyMiVz9Js4CwzPiV8";

let dynamoClient;
let config;
let logger;
let req;
let document;
let tokens;

describe("saveDocumentStateStrategy tests", () => {
  beforeEach(() => {
    config = createFakeConfig();
    config.hmac_secret = HMAC_SECRET;
    logger = buildFakeLogger();
    req = new MockExpressRequest({
      body: {
        code: CODE_HASH_PAIR[0],
      },
    });
    document = {
      state: STATE,
      code: CODE_HASH_PAIR[0],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      redirect_uri: REDIRECT_URI,
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
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).not.toHaveBeenCalled();
  });
  it("Happy Path with launch", () => {
    document.launch = LAUNCH;
    dynamoClient = buildFakeDynamoClient({
      state: STATE,
      code: CODE_HASH_PAIR[1],
      launch: LAUNCH,
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI,
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).not.toHaveBeenCalled();
  });
  it("Happy Path with launch w/o scope", () => {
    document.launch = LAUNCH;
    tokens.access_token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjpbIm9wZW5pZCJdLCJpYXQiOjE1MTYyMzkwMjJ9.cLdCTxvmVuJEr5gJEG_gv0C2j1AZyIYMWplicL9LYJA";
    dynamoClient = buildFakeDynamoClient({
      state: STATE,
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI,
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(dynamoClient.savePayloadToDynamo).not.toHaveBeenCalled();
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
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).not.toHaveBeenCalled();
    expect(dynamoClient.updateToDynamo).not.toHaveBeenCalled();
  });
  it("Could not save documents", () => {
    dynamoClient = jest.fn();
    dynamoClient.mockImplementation(() => {
      throw new Error("Test Error");
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamoClient,
      config
    );
    strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).toHaveBeenCalled();
  });
});
