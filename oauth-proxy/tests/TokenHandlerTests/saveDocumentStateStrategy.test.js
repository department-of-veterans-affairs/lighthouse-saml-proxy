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

  it("Happy Path with launch w/o scope", async () => {
    document.launch = LAUNCH;
    tokens = buildToken(false, true, true, "openid");
    dynamoClient = buildFakeDynamoClient({
      state: STATE,
      internal_state: INTERNAL_STATE,
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
    expect(dynamoClient.updateToDynamo).toHaveBeenCalledWith(
      { internal_state: "1234-5678-9100-0000" },
      {
        expires_on: 3628800,
        refresh_token:
          "9b4dba523ad0a7e323452871556d691787cd90c6fe959b040c5864979db5e337",
        access_token:
          "4116ff9d9b7bb73aff7680b14eb012670eb93cfc7266f142f13bd1486ae6cbb1",
        iss: "issuer",
      },
      "OAuthRequestsV2"
    );
    expect(dynamoClient.savePayloadToDynamo).not.toHaveBeenCalled();
  });
  it("Happy Path w/o internal_state", async () => {
    document = {
      state: STATE,
      code: CODE_HASH_PAIR[0],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      redirect_uri: REDIRECT_URI,
    };
    tokens = buildToken(false, true, true, "openid");
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
    expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalledWith(
      {
        expires_on: 3628800,
        internal_state: "fake-uuid",
        redirect_uri: "http://localhost/thisDoesNotMatter",
        refresh_token:
          "9b4dba523ad0a7e323452871556d691787cd90c6fe959b040c5864979db5e337",
        state: "abc123",
        access_token:
          "4116ff9d9b7bb73aff7680b14eb012670eb93cfc7266f142f13bd1486ae6cbb1",
        iss: "issuer",
      },
      "OAuthRequestsV2"
    );
    expect(dynamoClient.updateToDynamo).not.toHaveBeenCalled();
  });
  it("Happy Path w/o internal_state with launch", async () => {
    document = {
      state: STATE,
      code: CODE_HASH_PAIR[0],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      redirect_uri: REDIRECT_URI,
      launch: LAUNCH,
    };
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
      config,
      "issuer"
    );
    await strategy.saveDocumentToDynamo(document, tokens);
    expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalledWith(
      {
        expires_on: 3628800,
        internal_state: "fake-uuid",
        redirect_uri: "http://localhost/thisDoesNotMatter",
        refresh_token:
          "9b4dba523ad0a7e323452871556d691787cd90c6fe959b040c5864979db5e337",
        state: "abc123",
        access_token:
          "445e86848afba374749043f46fbee19b4d06eec99f3b876ddc32a7f8aec67dcd",
        iss: "issuer",
        launch: LAUNCH,
      },
      "OAuthRequestsV2"
    );
    expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalledWith(
      {
        access_token:
          "445e86848afba374749043f46fbee19b4d06eec99f3b876ddc32a7f8aec67dcd",
        expires_on: 300,
        launch: "1234V5678",
      },
      "LaunchContext"
    );
    expect(dynamoClient.updateToDynamo).not.toHaveBeenCalled();
  });

  it("Happy Path w/o internal_state err on dynamo save", async () => {
    document = {
      state: STATE,
      code: CODE_HASH_PAIR[0],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      redirect_uri: REDIRECT_URI,
      launch: LAUNCH,
    };
    tokens.expires_at = 1234;
    dynamoClient = {
      savePayloadToDynamo: jest.fn(),
      updateToDynamo: jest.fn(),
    };
    dynamoClient.savePayloadToDynamo.mockImplementation(() => {
      throw {};
    });
    let strategy = new SaveDocumentStateStrategy(
      req,
      logger,
      dynamoClient,
      config,
      "issuer"
    );
    await strategy
      .saveDocumentToDynamo(document, tokens)
      .then(() => fail("should have thrown error"))
      .catch(() => expect(true));
    // expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalled();
    expect(dynamoClient.savePayloadToDynamo).toHaveBeenCalledWith(
      {
        access_token:
          "4116ff9d9b7bb73aff7680b14eb012670eb93cfc7266f142f13bd1486ae6cbb1",
        expires_on: 300,
        launch: "1234V5678",
      },
      "LaunchContext"
    );
    expect(dynamoClient.updateToDynamo).not.toHaveBeenCalled();
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
