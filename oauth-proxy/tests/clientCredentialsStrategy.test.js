require("jest");
const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const MockExpressRequest = require("mock-express-request");
const { buildFakeDynamoClient } = require("./testUtils");
const {
  ClientCredentialsStrategy,
} = require("../oauthHandlers/tokenHandlerStrategyClasses/clientCredentialsStrategy");

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
        client_assertion: "tbd",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    const data = {
      token_type: "Bearer",
      expires_in: 3600,
      access_token:
        "eyJraWQiOiIzZkJCV0trc2JfY2ZmRGtYbVlSbmN1dGNtamFFMEFjeVdkdWFZc1NVa3o4IiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULnBwTUFxTG9UZ2VGamlCdUVnbmE0eWpCUGMzQWtUTndjRS1mVlgxVm4wVGMiLCJpc3MiOiJodHRwczovL2RlcHR2YS1ldmFsLm9rdGEuY29tL29hdXRoMi9hdXM4amExNXp6YjNwM21uWTJwNyIsImF1ZCI6Imh0dHBzOi8vc2FuZGJveC1hcGkudmEuZ292L3NlcnZpY2VzL2NjIiwiaWF0IjoxNjA0MzY5NDMxLCJleHAiOjE2MDQzNzMwMzEsImNpZCI6IjBvYThvNzlsM2pXMFd6WjFMMnA3Iiwic2NwIjpbImxhdW5jaC9wYXRpZW50Il0sInN1YiI6IjBvYThvNzlsM2pXMFd6WjFMMnA3IiwiYWJjIjoiMTIzIiwidGVzdCI6IjEyMyJ9.d4xtIXW4vmJIZoqdUu3UDr2jeQ0Boveibl-6qfvbjI9ETPvw8ZCiXtqqokUoZ3G2M6g1ZN6WOFlDTCFQc85qWGpLDT3VVNLmgML-26faC3Enj7fGSeJQKDOkwriGLr9Ep6upZm2Tl5dZFjeRseSHLA50YkVz1U55NH9fKT5Vsp4Ew9lllEqQs3-S0gGsiUBxGkvC7VGlsy8fXBYXd1e8T20Jw1hKyu4jSpS74gqSxhu_m0x_Aa7gUjF_A5irVv0xiVqxPdOnfN1od8JI0KnMYDgGzLgFrVft83cVD8imHUj_TvbTKehF-72-3jz3pg8a_vLu2Ld4Opzflk6J4ut-2w",
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

  it("handles invalid client_credentials request", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "tbd",
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
      token_endpoint
    );

    try {
      await clientCredentialsStrategy.getTokenResponse();
    } catch (error) {
      expect(error.statusCode).toEqual(401);
      expect(error.error).toEqual("invalid_client");
    }
  });

  it("handles client_credentials launch", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "tbd",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint
    );

    let expectedPatient = await clientCredentialsStrategy.createPatientInfo(
      null,
      null
    );
    expect(expectedPatient).toEqual("123V456");
  });
});
