require("jest");

const {
  GetDocumentByRefreshTokenStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/documentStrategies/getDocumentByRefreshTokenStrategy");

const {
  buildFakeDynamoClient,
  buildFakeLogger,
  createFakeConfig,
} = require("../testUtils");
const MockExpressRequest = require("mock-express-request");

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

let dynamoClient;
let config;
let logger;
let req;

describe("getDocumentByRefreshTokenStrategy tests", () => {
  beforeEach(() => {
    config = createFakeConfig();
    config.hmac_secret = HMAC_SECRET;
    logger = buildFakeLogger();
    req = new MockExpressRequest({
      body: {
        refresh_token: REFRESH_TOKEN_HASH_PAIR[0],
      },
    });
  });

  it("Happy Path - Hashed Token", async () => {
    dynamoClient = buildFakeDynamoClient({
      state: STATE,
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI,
    });

    let strategy = new GetDocumentByRefreshTokenStrategy(
      req,
      logger,
      dynamoClient,
      config
    );
    let document = await strategy.getDocument();

    expect(document).toEqual({
      state: STATE,
      code: CODE_HASH_PAIR[1],
      refresh_token: REFRESH_TOKEN_HASH_PAIR[1],
      redirect_uri: REDIRECT_URI,
    });
  });

  it("Could not retrieve Token", async () => {
    dynamoClient = buildFakeDynamoClient();
    let usernamePassword = Buffer.from("user1:pass1").toString("base64");
    req.headers = { authorization: `Basic ${usernamePassword}` };
    let strategy = new GetDocumentByRefreshTokenStrategy(
      req,
      logger,
      dynamoClient,
      config
    );

    let document = await strategy.getDocument();
    expect(document).toEqual(undefined);
    expect(logger.warn).toHaveBeenCalledWith(
      "OAuthRequestsV2 refresh_token not found. Searching for OAuthRequests refresh_token."
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Fallback OAuthRequests refresh_token not found.",
      {
        client_id:
          "590723609fa552658d3fc7aad1d720245b3e5bd904e6d59b0e4433b4b5c749b4",
        hashed_id:
          "69e8cdbb4940d26e6d11a81e56b3d754f49b33453754bbd087b35d09f9c5f7ba",
      }
    );
  });

  it("Could not retrieve Token, ClientID in body", async () => {
    dynamoClient = buildFakeDynamoClient();
    let strategy = new GetDocumentByRefreshTokenStrategy(
      req,
      logger,
      dynamoClient,
      config,
      "user1"
    );

    let document = await strategy.getDocument();
    expect(document).toEqual(undefined);
    expect(logger.warn).toHaveBeenCalledWith(
      "OAuthRequestsV2 refresh_token not found. Searching for OAuthRequests refresh_token."
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Fallback OAuthRequests refresh_token not found.",
      {
        client_id:
          "590723609fa552658d3fc7aad1d720245b3e5bd904e6d59b0e4433b4b5c749b4",
        hashed_id:
          "69e8cdbb4940d26e6d11a81e56b3d754f49b33453754bbd087b35d09f9c5f7ba",
      }
    );
  });
});
