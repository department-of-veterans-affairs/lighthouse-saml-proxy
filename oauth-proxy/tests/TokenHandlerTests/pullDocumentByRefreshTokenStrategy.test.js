require("jest");

const {
  PullDocumentByRefreshTokenStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/pullDocumentStrategies/pullDocumentByRefreshTokenStrategy");

const {
  buildFakeDynamoClient,
  buildFakeLogger,
  createFakeConfig,
} = require("../testUtils");
const MockExpressRequest = require("mock-express-request");

const HMAC_SECRET = "secret";
const STATE_HASH_PAIR = ["abc123", "abc123"];
const CODE_HASH_PAIR = [
  "the_fake_authorization_code",
  "9daf298b2cb68502791f6f264aef8ebb56dc0ddd3542fbd1c4bd675538fd9cb8",
];
const REFRESH_TOKEN_HASH_PAIR = [
  "the_fake_refresh_token",
  "9b4dba523ad0a7e323452871556d691787cd90c6fe959b040c5864979db5e337",
];
const REDIRECT_URI_HASH_PAIR = [
  "http://localhost/thisDoesNotMatter",
  "http://localhost/thisDoesNotMatter",
];

let dynamoClient;
let config;
let dynamo;
let logger;
let req;

describe("pullDocumentByRefreshTokenStrategy tests", () => {
  beforeEach(() => {
    config = createFakeConfig();
    config.hmac_secret = HMAC_SECRET;
    dynamo = jest.mock();
    logger = buildFakeLogger();
    req = new MockExpressRequest({
      body: {
        refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      },
    });
  });

  it("Happy Path - Unhashed Token", async () => {
    dynamoClient = buildFakeDynamoClient({
      state: STATE_HASH_PAIR[0],
      code: CODE_HASH_PAIR[0],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      redirect_uri: REDIRECT_URI_HASH_PAIR[0],
    });

    let strategy = new PullDocumentByRefreshTokenStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );
    let document = await strategy.pullDocumentFromDynamo();

    expect(document).toEqual({
      state: { S: STATE_HASH_PAIR[0] },
      code: { S: CODE_HASH_PAIR[0] },
      refresh_token: { S: REFRESH_TOKEN_HASH_PAIR[0] },
      redirect_uri: { S: REDIRECT_URI_HASH_PAIR[0] },
    });
  });

  it("Happy Path - Hashed Token", async () => {
    dynamoClient = buildFakeDynamoClient({
      state: STATE_HASH_PAIR[1],
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI_HASH_PAIR[1],
    });

    let strategy = new PullDocumentByRefreshTokenStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );
    let document = await strategy.pullDocumentFromDynamo();

    expect(document).toEqual({
      state: { S: STATE_HASH_PAIR[1] },
      code: { S: CODE_HASH_PAIR[1] },
      refresh_token: { S: REFRESH_TOKEN_HASH_PAIR[1] },
      redirect_uri: { S: REDIRECT_URI_HASH_PAIR[1] },
    });
  });

  it("Could not retrieve Token", async () => {
    dynamoClient = buildFakeDynamoClient();
    let strategy = new PullDocumentByRefreshTokenStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );

    let document = await strategy.pullDocumentFromDynamo();
    expect(document).toEqual(undefined);
  });
});
