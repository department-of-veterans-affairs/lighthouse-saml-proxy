require("jest");
const MockExpressRequest = require("mock-express-request");
const { tokenHandler } = require("../../oauthHandlers");
const {
  FakeIssuer,
  buildFakeDynamoClient,
  createFakeConfig,
  buildFakeLogger,
} = require("../testUtils");
const { buildValidateToken } = require("./tokenHandlerTestUtils");
const {
  buildTokenHandlerClient,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenHandlerClientBuilder");
jest.mock(
  "../../oauthHandlers/tokenHandlerStrategyClasses/tokenHandlerClientBuilder",
  () => ({ buildTokenHandlerClient: jest.fn() })
);

let config;
let redirect_uri;
let issuer;
let logger;
let dynamoClient;
let next;
let validateToken;
let staticTokens;
let req;
let res;

beforeEach(() => {
  config = createFakeConfig();
  redirect_uri = jest.mock();
  logger = buildFakeLogger();
  dynamoClient = buildFakeDynamoClient({
    state: "abc123",
    code: "the_fake_authorization_code",
    refresh_token: "",
    redirect_uri: "http://localhost/thisDoesNotMatter",
  });
  validateToken = buildValidateToken({});
  staticTokens = new Map();
  next = jest.fn();
  issuer = new FakeIssuer(dynamoClient);
  req = new MockExpressRequest();
  res = {};
  res.status = jest.fn();
  res.status.mockImplementation(() => res);
  res.json = jest.fn();
  res.json.mockImplementation(() => res);
  next = jest.fn();
});

afterEach(() => {
  // expressjs requires that all handlers call next() unless they want to
  // stop the remaining middleware from running. Since the remaining
  // middleware is defined by the application, this should not be done by the
  // tokenHandler at all.
  expect(next).toHaveBeenCalled();
});

describe("tokenHandler tests", () => {
  it("Happy Path", async () => {
    const handleToken = jest.fn();
    handleToken.mockImplementation(() => {
      return new Promise((resolve) =>
        resolve({ statusCode: 200, responseBody: "response" })
      );
    });
    buildTokenHandlerClient.mockImplementation(() => {
      return { handleToken: handleToken };
    });

    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      validateToken,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.status).toHaveBeenLastCalledWith(200);
    expect(res.json).toHaveBeenLastCalledWith("response");
  });

  it("buildTokenHandlerClient error", async () => {
    buildTokenHandlerClient.mockImplementation(() => {
      throw {
        status: 500,
        error: "error",
        error_description: "error_description",
      };
    });

    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      validateToken,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.status).toHaveBeenLastCalledWith(500);
    expect(res.json).toHaveBeenLastCalledWith({
      error: "error",
      error_description: "error_description",
    });
  });

  it("handleToken error", async () => {
    const handleToken = jest.fn();
    handleToken.mockImplementation(() => {
      throw { statusCode: 500, responseBody: "error" };
    });
    buildTokenHandlerClient.mockImplementation(() => {
      return { handleToken: handleToken };
    });

    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      validateToken,
      staticTokens,
      req,
      res,
      next
    );
    expect(next).toHaveBeenLastCalledWith({
      statusCode: 500,
      responseBody: "error",
    });
  });
});
