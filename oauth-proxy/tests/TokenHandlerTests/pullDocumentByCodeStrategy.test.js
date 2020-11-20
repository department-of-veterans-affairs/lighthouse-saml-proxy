require("jest");

const {
  PullDocumentByCodeStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/pullDocumentStrategies/pullDocumentByCodeStrategy");

const {
  buildFakeDynamoClient,
  buildFakeLogger,
  buildFakeConfig,
} = require("./testUtils");
const MockExpressRequest = require("mock-express-request");

const HMAC_SECRET = "secret";
const STATE_HASH_PAIR = [
  "abc123",
  "5ae5ac802a1a5c94fb683e1bfa121f9f700a26995213ff2fc1c503eb43ec71c6",
];
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
  "546aac15121c5a4ab9ffa9cac0c69afaef0875793c5ece478b303c6f50234284",
];

let dynamoClient;
let config;
let dynamo;
let logger;
let req;
describe("pullDocumentByCodeStrategy tests", () => {
  beforeEach(() => {
    config = buildFakeConfig();
    config.hmac_secret = HMAC_SECRET;
    dynamo = jest.mock();
    logger = buildFakeLogger();
    req = new MockExpressRequest({
      body: {
        code: CODE_HASH_PAIR[0],
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

    let strategy = new PullDocumentByCodeStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );
    let document = await strategy.pullDocumentFromDynamo();
    expect(document).toEqual({
      state: STATE_HASH_PAIR[0],
      code: CODE_HASH_PAIR[0],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      redirect_uri: REDIRECT_URI_HASH_PAIR[0],
    });
  });

  it("Happy Path - Hashed Token", async () => {
    dynamoClient = buildFakeDynamoClient({
      state: STATE_HASH_PAIR[1],
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI_HASH_PAIR[1],
    });

    let strategy = new PullDocumentByCodeStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );
    let document = await strategy.pullDocumentFromDynamo();
    expect(document).toEqual({
      state: STATE_HASH_PAIR[1],
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI_HASH_PAIR[1],
    });
  });

  it("Could not retrieve Token", async () => {
    let strategy = new PullDocumentByCodeStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      config
    );

    let document = strategy.pullDocumentFromDynamo();
    expect(document).toBe(null);
  });
});
