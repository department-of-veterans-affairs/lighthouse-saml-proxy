require("jest");
const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const MockExpressRequest = require("mock-express-request");
const { buildFakeDynamoClient, jwtEncodeClaims } = require("./testUtils");
const {
  ClientCredentialsStrategy,
} = require("../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/clientCredentialsStrategy");
const {
  GetPatientInfoFromLaunchStrategy,
} = require("../oauthHandlers/tokenHandlerStrategyClasses/getPatientInfoStrategies/getPatientInfoFromLaunchStrategy");
let logger;
let dynamo;
let dynamoClient;
let token_endpoint = "http://localhost:9090/testServer/token";
let mock = new MockAdapter(axios);

beforeEach(() => {
  logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  dynamo = jest.mock();
  dynamoClient = jest.mock();
  jest.mock("axios", () => ({ post: jest.fn(), create: jest.fn() }));

  dynamoClient = buildFakeDynamoClient({
    state: "abc123",
    code: "the_fake_authorization_code",
    refresh_token: "",
    redirect_uri: "http://localhost/thisDoesNotMatter",
  });
});

describe("tokenHandler clientCredentials", () => {
  it("handles the client_credentials flow", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "valid-assertion",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    const claims = {
      aud: "https://ut/v1/token",
      iss: "ut_iss",
      sub: "ut_sub",
      jti: "ut_jti",
    };
    const expire_on = new Date().getTime() + 300 * 1000;
    const encodedClaims = jwtEncodeClaims(claims, expire_on);

    const data = {
      token_type: "Bearer",
      expires_in: 3600,
      access_token: encodedClaims,
      scope: "launch/patient",
    };
    mock.onPost(token_endpoint).reply(200, data);

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint
    );

    let token = await clientCredentialsStrategy.getTokenResponse();
    expect(token).toEqual(data);
  });

  it("handles invalid client_credentials request invalid_client", async () => {
    const claims = {
      aud: "https://ut/v1/token",
      iss: "ut_iss",
      sub: "ut_invalid",
      jti: "ut_invalid",
    };
    const expire_on = new Date().getTime() + 300 * 1000;
    const encodedClaims = jwtEncodeClaims(claims, expire_on);

    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: encodedClaims,
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    const errResp = {
      status: 400,
      errorCode: "invalid_client",
      errorSummary: "Invalid value for 'client_id' parameter.",
      response: { error: "invalid_clients" },
    };
    mock.onPost(token_endpoint).reply(400, errResp);

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint,
      {}
    );

    try {
      await clientCredentialsStrategy.getTokenResponse();
    } catch (error) {
      expect(error.statusCode).toEqual(400);
      expect(error.error).toEqual("invalid_client");
      expect(error.error_description).toEqual(
        "Invalid value for 'client_id' parameter."
      );
    }
  });

  it("handles invalid client_credentials request expired assertion", async () => {
    const claims = {
      aud: "https://ut/v1/token",
      iss: "ut_iss",
      sub: "ut_invalid",
      jti: "ut_invalid",
    };
    const expire_on = new Date().getTime() - 1; // expired
    const encodedClaims = jwtEncodeClaims(claims, expire_on);
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: encodedClaims,
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    const errResp = {
      status: 401,
      error: "invalid_client",
      error_description: "The client_assertion token is expired.",
      response: { error: "invalid_clients" },
    };
    mock.onPost(token_endpoint).reply(401, errResp);

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint,
      {}
    );

    try {
      await clientCredentialsStrategy.getTokenResponse();
    } catch (error) {
      expect(error.statusCode).toEqual(401);
      expect(error.error).toEqual("invalid_client");
      expect(error.error_description).toEqual(
        "The client_assertion token is expired."
      );
    }
  });

  it("handles invalid client_credentials request unknown error", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "unknown-failed-assertion",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    const errResp = {
      status: 500,
      error: "unexpected_error",
      response: { error: "unexpected_error" },
    };
    mock.onPost(token_endpoint).reply(500, errResp);

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint
    );

    try {
      await clientCredentialsStrategy.getTokenResponse();
      expect(false).toEqual(true); // fail if this spot is reached
    } catch (error) {
      expect(error.statusCode).toEqual(500);
      expect(logger.error).toHaveBeenCalledWith({
        message: "Server returned status code 500",
      });
    }
  });

  it("handles client_credentials launch", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion:
          "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJodHRwczovL3V0L3YxL3Rva2VuIiwiaXNzIjoidXRfaXNzIiwic3ViIjoidXRfc3ViIiwianRpIjoiOTdiN2ZkZjAtMmRjZi0xMWViLTkxOTAtMTk0M2IxMDE4NjczIiwiaWF0IjoxNjA2MTY1NTE5LCJleHAiOjE2MDYxNjU4MTl9.G_33TMKNTgH2HBTpq2Ir5KVYJIkB_3TDidhukBWSdOxEe1THZMwaCgCh4hfgYEPS_ttKBttYo5Zfe40G8sthUKHHHxj3_Ly8tHxkiRTmyRT_aDUXjMsPOLQB3aIf0o4bo8RmtSJc8ev7gk-tDdZHDFL1MYQFbr_DwbWsZIvOeocQ6T9Fk1S0ACTaeXZFV3ZiFU3iE-oS91VcsPDEZE-X7wZ-hbDYv2N3lRIihqIYKXTjPLo3d-MMJ4L3ssavmVchlKy9-D58pmQA9sIfzSk9p0Ip2UXJtPiWsY5qFuuFqgTCwrXNnX5qaCRHHmU03cqLHLmcJwKSo9PymAhpcd-AHA",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    let clientCredentialsStrategy = new GetPatientInfoFromLaunchStrategy(req);
    let expectedPatient = await clientCredentialsStrategy.createPatientInfo(
      null,
      null
    );
    expect(expectedPatient).toEqual("123V456");
  });
});
