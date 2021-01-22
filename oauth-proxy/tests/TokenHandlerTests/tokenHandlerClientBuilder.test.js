const {
  buildTokenHandlerClient,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenHandlerClientBuilder");
const {
  RefreshTokenStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/refreshTokenStrategy");
const {
  AuthorizationCodeStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/authorizationCodeStrategy");
const {
  ClientCredentialsStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/clientCredentialsStrategy");
const {
  UnsupportedGrantStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/unsupportedGrantStrategy");
const {
  GetDocumentByRefreshTokenStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/documentStrategies/getDocumentByRefreshTokenStrategy");
const {
  GetDocumentByCodeStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/documentStrategies/getDocumentByCodeStrategy");
const {
  GetDocumentByLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/documentStrategies/getDocumentByLaunchStrategy");
const {
  SaveDocumentStateStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/saveDocumentStrategies/saveDocumentStateStrategy");
const {
  SaveDocumentLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/saveDocumentStrategies/saveDocumentLaunchStrategy");
const {
  GetPatientInfoFromValidateEndpointStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/getPatientInfoStrategies/getPatientInfoFromValidateEndpointStrategy");
const {
  GetPatientInfoFromLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/getPatientInfoStrategies/getPatientInfoFromLaunchStrategy");
const {
  FakeIssuer,
  buildFakeDynamoClient,
  buildFakeLogger,
  createFakeConfig,
} = require("../testUtils");
const MockExpressRequest = require("mock-express-request");
const MockExpressResponse = require("mock-express-response");
const { encodeBasicAuthHeader } = require("../../utils");

require("jest");

describe("buildTokenHandlerClient Tests", () => {
  let redirect_uri = "https://redirect.com";
  let issuer = new FakeIssuer();
  let logger = buildFakeLogger();
  let dynamo = {};
  let dynamoClient = buildFakeDynamoClient({});
  let config = createFakeConfig();
  let req;
  let res = new MockExpressResponse();
  let next = jest.fn();
  let validateToken = {};
  let staticTokens = {};

  it("Refresh Client Basic Auth", () => {
    req = new MockExpressRequest({
      body: {
        grant_type: "refresh_token",
      },
      headers: {
        authorization: encodeBasicAuthHeader("user", "pass"),
      },
    });

    let response = buildTokenHandlerClient(
      redirect_uri,
      issuer,
      logger,
      dynamo,
      dynamoClient,
      config,
      req,
      res,
      next,
      validateToken,
      staticTokens
    );

    expect(response.getTokenStrategy).toBeInstanceOf(RefreshTokenStrategy);
    expect(response.getDocumentStrategy).toBeInstanceOf(
      GetDocumentByRefreshTokenStrategy
    );
    expect(response.saveDocumentToDynamoStrategy).toBeInstanceOf(
      SaveDocumentStateStrategy
    );
    expect(response.getPatientInfoStrategy).toBeInstanceOf(
      GetPatientInfoFromValidateEndpointStrategy
    );
  });

  it("Refresh Client Body Auth", () => {
    req = new MockExpressRequest({
      body: {
        grant_type: "refresh_token",
        client_id: "client id",
        client_secret: "client secret",
      },
    });
    let response = buildTokenHandlerClient(
      redirect_uri,
      issuer,
      logger,
      dynamo,
      dynamoClient,
      config,
      req,
      res,
      next,
      validateToken,
      staticTokens
    );

    expect(response.getTokenStrategy).toBeInstanceOf(RefreshTokenStrategy);
    expect(response.getDocumentStrategy).toBeInstanceOf(
      GetDocumentByRefreshTokenStrategy
    );
    expect(response.saveDocumentToDynamoStrategy).toBeInstanceOf(
      SaveDocumentStateStrategy
    );
    expect(response.getPatientInfoStrategy).toBeInstanceOf(
      GetPatientInfoFromValidateEndpointStrategy
    );
  });

  it("Code Client PKCE Auth", () => {
    req = new MockExpressRequest({
      body: {
        grant_type: "authorization_code",
        client_id: "client id",
      },
    });
    let response = buildTokenHandlerClient(
      redirect_uri,
      issuer,
      logger,
      dynamo,
      dynamoClient,
      config,
      req,
      res,
      next,
      validateToken,
      staticTokens
    );

    expect(response.getTokenStrategy).toBeInstanceOf(AuthorizationCodeStrategy);
    expect(response.getDocumentStrategy).toBeInstanceOf(
      GetDocumentByCodeStrategy
    );
    expect(response.saveDocumentToDynamoStrategy).toBeInstanceOf(
      SaveDocumentStateStrategy
    );
    expect(response.getPatientInfoStrategy).toBeInstanceOf(
      GetPatientInfoFromValidateEndpointStrategy
    );
  });

  it("ClientCredentials Client", () => {
    req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      },
    });
    let response = buildTokenHandlerClient(
      redirect_uri,
      issuer,
      logger,
      dynamo,
      dynamoClient,
      config,
      req,
      res,
      next,
      validateToken,
      staticTokens
    );

    expect(response.getTokenStrategy).toBeInstanceOf(ClientCredentialsStrategy);
    expect(response.getDocumentStrategy).toBeInstanceOf(
      GetDocumentByLaunchStrategy
    );
    expect(response.saveDocumentToDynamoStrategy).toBeInstanceOf(
      SaveDocumentLaunchStrategy
    );
    expect(response.getPatientInfoStrategy).toBeInstanceOf(
      GetPatientInfoFromLaunchStrategy
    );
  });

  it("Request with No Grant. Throws Error.", () => {
    req = new MockExpressRequest({
      body: {},
    });
    let error = {
      status: 400,
      error: "invalid_request",
      error_description:
        "A grant type is required. Supported grant types are authorization_code, refresh_token, and client_credentials.",
    };
    try {
      buildTokenHandlerClient(
        redirect_uri,
        issuer,
        logger,
        dynamo,
        dynamoClient,
        config,
        req,
        res,
        next,
        validateToken,
        staticTokens
      );
      fail("Requests with no grants should not return a client.");
    } catch (err) {
      expect(err).toEqual(error);
    }
  });

  it("Unsupported Grant Client", () => {
    req = new MockExpressRequest({
      body: {
        grant_type: "unsupported",
      },
    });
    let response = buildTokenHandlerClient(
      redirect_uri,
      issuer,
      logger,
      dynamo,
      dynamoClient,
      config,
      req,
      res,
      next,
      validateToken,
      staticTokens
    );

    expect(response.getTokenStrategy).toBeInstanceOf(UnsupportedGrantStrategy);
  });

  it("Code Client Invalid Auth", () => {
    req.body.grant_type = "authorization_code";
    req = new MockExpressRequest({
      body: {
        grant_type: "authorization_code",
      },
    });
    try {
      buildTokenHandlerClient(
        redirect_uri,
        issuer,
        logger,
        dynamo,
        dynamoClient,
        config,
        req,
        res,
        next,
        validateToken,
        staticTokens
      );
      fail("Invalid auth error should have been thrown.");
    } catch (err) {
      expect(err.status).toBe(401);
      expect(err.error).toBe("invalid_client");
      expect(err.error_description).toBe("Client authentication failed");
      return;
    }
  });

  it("ClientCredentials Client Invalid Assertion Type", () => {
    req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion_type: "invalid",
      },
    });

    try {
      buildTokenHandlerClient(
        redirect_uri,
        issuer,
        logger,
        dynamo,
        dynamoClient,
        config,
        req,
        res,
        next,
        validateToken,
        staticTokens
      );
      fail("Invalid assertion type error should have been thrown.");
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.error).toBe("invalid_request");
      expect(err.error_description).toBe(
        "Client assertion type must be jwt-bearer."
      );
      return;
    }
  });
});
