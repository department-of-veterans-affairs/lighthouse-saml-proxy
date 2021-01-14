require("jest");

const {
  TokenHandlerClient,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenHandlerClient");
const {
  buildGetDocumentStrategy,
  buildSaveDocumentStrategy,
  buildGetPatientInfoStrategy,
  buildToken,
  buildGetTokenStrategy,
} = require("./tokenHandlerTestUtils");
const MockExpressRequest = require("mock-express-request");
const MockExpressResponse = require("mock-express-response");

describe("handleToken tests", () => {
  let getTokenResponseStrategy;
  let pullDocumentFromDynamoStrategy;
  let saveDocumentToDynamoStrategy;
  let getPatientInfoStrategy;
  let req;
  let res;
  let next;

  it("Happy Path Static", async () => {
    let token = buildToken(true, false);
    getTokenResponseStrategy = buildGetTokenStrategy(token, false);
    pullDocumentFromDynamoStrategy = buildGetDocumentStrategy({});
    saveDocumentToDynamoStrategy = buildSaveDocumentStrategy();
    getPatientInfoStrategy = buildGetPatientInfoStrategy({});
    req = new MockExpressRequest();
    res = new MockExpressResponse();
    next = jest.fn();

    let response = await new TokenHandlerClient(
      getTokenResponseStrategy,
      pullDocumentFromDynamoStrategy,
      saveDocumentToDynamoStrategy,
      getPatientInfoStrategy,
      req,
      res,
      next
    ).handleToken();

    expect(response.statusCode).toBe(200);
    expect(response.responseBody).toBe(token);
  });

  it("Happy Path no launch/patient", async () => {
    let token = buildToken(false, false);
    getTokenResponseStrategy = buildGetTokenStrategy(token);
    pullDocumentFromDynamoStrategy = buildGetDocumentStrategy({});
    saveDocumentToDynamoStrategy = buildSaveDocumentStrategy();
    getPatientInfoStrategy = buildGetPatientInfoStrategy({});
    req = new MockExpressRequest();
    res = new MockExpressResponse();
    next = jest.fn();

    let response = await new TokenHandlerClient(
      getTokenResponseStrategy,
      pullDocumentFromDynamoStrategy,
      saveDocumentToDynamoStrategy,
      getPatientInfoStrategy,
      req,
      res,
      next
    ).handleToken();

    expect(response.statusCode).toBe(200);
    expect(response.responseBody.access_token).toBe(token.access_token);
  });

  it("Happy Path with launch/patient", async () => {
    let token = buildToken(false, true);
    getTokenResponseStrategy = buildGetTokenStrategy(token, false);
    pullDocumentFromDynamoStrategy = buildGetDocumentStrategy({});
    saveDocumentToDynamoStrategy = buildSaveDocumentStrategy();
    getPatientInfoStrategy = buildGetPatientInfoStrategy("patient");
    req = new MockExpressRequest();
    res = new MockExpressResponse();
    next = jest.fn();

    let response = await new TokenHandlerClient(
      getTokenResponseStrategy,
      pullDocumentFromDynamoStrategy,
      saveDocumentToDynamoStrategy,
      getPatientInfoStrategy,
      req,
      res,
      next
    ).handleToken();

    expect(response.statusCode).toBe(200);
    expect(response.responseBody.access_token).toBe(token.access_token);
    expect(response.responseBody.patient).toBe("patient");
  });

  it("getToken 401 Response", async () => {
    let err = {
      statusCode: 401,
    };
    getTokenResponseStrategy = buildGetTokenStrategy(err, true);
    pullDocumentFromDynamoStrategy = buildGetDocumentStrategy({});
    saveDocumentToDynamoStrategy = buildSaveDocumentStrategy();
    getPatientInfoStrategy = buildGetPatientInfoStrategy({});
    req = new MockExpressRequest();
    res = new MockExpressResponse();
    next = jest.fn();

    let response = await new TokenHandlerClient(
      getTokenResponseStrategy,
      pullDocumentFromDynamoStrategy,
      saveDocumentToDynamoStrategy,
      getPatientInfoStrategy,
      req,
      res,
      next
    ).handleToken();

    expect(response.statusCode).toBe(401);
    expect(response.responseBody.error).toBe("invalid_client");
    expect(response.responseBody.error_description).toBe(
      "Invalid value for client_id parameter."
    );
  });

  it("getToken 500 Response", async () => {
    let err = {
      statusCode: 500,
      error: "error",
      error_description: "error_description",
    };
    getTokenResponseStrategy = buildGetTokenStrategy(err, true);
    pullDocumentFromDynamoStrategy = buildGetDocumentStrategy({});
    saveDocumentToDynamoStrategy = buildSaveDocumentStrategy();
    getPatientInfoStrategy = buildGetPatientInfoStrategy({});
    req = new MockExpressRequest();
    res = new MockExpressResponse();
    next = jest.fn();

    let response = await new TokenHandlerClient(
      getTokenResponseStrategy,
      pullDocumentFromDynamoStrategy,
      saveDocumentToDynamoStrategy,
      getPatientInfoStrategy,
      req,
      res,
      next
    ).handleToken();

    expect(response.statusCode).toBe(500);
    expect(response.responseBody.error).toBe("error");
    expect(response.responseBody.error_description).toBe("error_description");
  });
});
