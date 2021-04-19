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
jest.mock("uuid", () => ({
  v4: () => "fake-uuid",
}));

const { buildToken } = require("./tokenHandlerTestUtils");

const HMAC_SECRET = "secret";
const STATE = "abc123";
const INTERNAL_STATE = "1234-5678-9100-0000";
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
      internal_state: INTERNAL_STATE,
      code: CODE_HASH_PAIR[0],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      redirect_uri: REDIRECT_URI,
    };
    tokens = buildToken(false, true, true, "launch");
    jest.spyOn(global.Math, "round").mockReturnValue(0);
  });

  afterEach(() => {
    jest.spyOn(global.Math, "round").mockRestore();
  });

  it("Happy Path", async () => {
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
      config,
      "issuer"
    );
    await strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).not.toHaveBeenCalled();
  });
  it("Happy Path with launch", async () => {
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
      config,
      "issuer"
    );
    await strategy.saveDocumentToDynamo(document, tokens);
    expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalledWith(
      {
        access_token:
          "4116ff9d9b7bb73aff7680b14eb012670eb93cfc7266f142f13bd1486ae6cbb1",
        expires_on: 300,
        launch: "1234V5678",
      },
      "LaunchContext"
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("Launch in Document not in Tokens", async () => {
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
      config,
      "issuer"
    );
    tokens = buildToken(false, true, false, "");
    await strategy.saveDocumentToDynamo(document, tokens);

    expect(logger.warn).toHaveBeenCalledWith(
      "Launch context specified but scope not granted."
    );
  });

  it("Save Launch Document throws error", async () => {
    document.launch = LAUNCH;
    dynamoClient = {
      saveDocumentToDynamo: () => {
        throw "Error";
      },
    };
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamoClient,
      config,
      "issuer"
    );
    try {
      await strategy.saveDocumentToDynamo(document, tokens);
      fail("Should have thrown error");
    } catch (error) {
      expect(error.status).toBe(500);
      expect(error.errorMessage).toBe("Could not save the launch context.");
    }
  });
  it("Happy Path no Refresh in Token", async () => {
    document.launch = LAUNCH;
    dynamoClient = buildFakeDynamoClient({
      state: STATE,
      code: CODE_HASH_PAIR[1],
      launch: LAUNCH,
      redirect_uri: REDIRECT_URI,
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamoClient,
      config,
      "issuer"
    );

    delete tokens.refresh_token;

    await strategy.saveDocumentToDynamo(document, tokens);
    expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalledWith(
      {
        access_token:
          "4116ff9d9b7bb73aff7680b14eb012670eb93cfc7266f142f13bd1486ae6cbb1",
        expires_on: 300,
        launch: "1234V5678",
      },
      "LaunchContext"
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("No Document State", async () => {
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
      config,
      "issuer"
    );
    await strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).not.toHaveBeenCalled();
    expect(dynamoClient.updateToDynamo).not.toHaveBeenCalled();
  });
  it("Could not save documents", async () => {
    dynamoClient = jest.fn();
    dynamoClient.mockImplementation(() => {
      throw new Error("Test Error");
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamoClient,
      config,
      "issuer"
    );
    await strategy.saveDocumentToDynamo(document, tokens);
    expect(logger.error).toHaveBeenCalled();
  });
});
