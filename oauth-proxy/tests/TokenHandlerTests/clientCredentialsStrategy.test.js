require("jest");
const axios = require("axios");
const MockAdapter = require("axios-mock-adapter");
const MockExpressRequest = require("mock-express-request");
const { buildFakeDynamoClient, buildFakeLogger } = require("../testUtils");
const {
  ClientCredentialsStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/clientCredentialsStrategy");
let logger;
let dynamo;
let dynamoClient;
let token_endpoint = "http://localhost:9090/testServer/token";
let mock = new MockAdapter(axios);

beforeEach(() => {
  logger = buildFakeLogger();
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

    let token = await clientCredentialsStrategy.getToken();
    expect(token).toEqual(data);
  });

  it("handles the client_credentials flow axios returns non 200", async () => {
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
    mock.onPost(token_endpoint).reply(() => {
      return [202, {}];
    });

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint
    );

    try {
      await clientCredentialsStrategy.getToken();
    } catch (err) {
      expect(err.statusCode).toBe(500);
    }
  });

  it("handles invalid client_credentials request invalid_client", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "invalid-client-assertion",
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
      token_endpoint
    );

    try {
      await clientCredentialsStrategy.getToken();
    } catch (error) {
      expect(error.statusCode).toEqual(400);
      expect(error.error).toEqual("invalid_client");
      expect(error.error_description).toEqual(
        "Invalid value for 'client_id' parameter."
      );
    }
  });

  it("handles invalid client_credentials request invalid_client no error code", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "invalid-client-assertion",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    const errResp = {
      status: 400,
      errorSummary: "Invalid value for 'client_id' parameter.",
      error: "No Error Code",
      error_description: "No Error Code Description",
      response: { error: "invalid_clients" },
    };
    mock.onPost(token_endpoint).reply(400, errResp);

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint
    );

    try {
      await clientCredentialsStrategy.getToken();
    } catch (error) {
      expect(error.statusCode).toEqual(400);
      expect(error.error).toEqual("No Error Code");
      expect(error.error_description).toEqual("No Error Code Description");
    }
  });
  it("handles invalid client_credentials request expired assertion", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "expired-assertion",
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
      await clientCredentialsStrategy.getToken();
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
      await clientCredentialsStrategy.getToken();
    } catch (error) {
      expect(error.statusCode).toEqual(500);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to retrieve access_token from token endpoint."
      );
      expect(logger.error).toHaveBeenCalledWith({
        message: "Server returned status code 500",
      });
    }
  });

  it("handles invalid client_credentials request unknown error no error response", async () => {
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

    mock.onPost(token_endpoint).reply(() => {
      throw { response: null, message: "This is an error message." };
    });

    let clientCredentialsStrategy = new ClientCredentialsStrategy(
      req,
      logger,
      dynamo,
      dynamoClient,
      token_endpoint
    );

    try {
      await clientCredentialsStrategy.getToken();
    } catch (error) {
      expect(error.statusCode).toEqual(500);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to retrieve access_token from token endpoint."
      );
      expect(logger.error).toHaveBeenCalledWith({
        message: "This is an error message.",
      });
    }
  });
});
