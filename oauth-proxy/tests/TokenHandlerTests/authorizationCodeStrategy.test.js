const { buildFakeLogger, buildFakeOktaClient } = require("../testUtils");
const Collection = require("@okta/okta-sdk-nodejs/src/collection");
const ModelFactory = require("@okta/okta-sdk-nodejs/src/model-factory");
const User = require("@okta/okta-sdk-nodejs/src/models/User");

const getAuthorizationServerInfoMock = jest.fn();

const userCollection = new Collection(null, "", new ModelFactory(User));
const MockExpressRequest = require("mock-express-request");
const {
  AuthorizationCodeStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/tokenStrategies/authorizationCodeStrategy");

require("jest");

describe("getToken tests", () => {
  let req = new MockExpressRequest();
  let logger = buildFakeLogger();
  let redirect_uri = "https://fakeredirect.com";
  let client;

  it("Happy Path", async () => {
    let token = "access_token";
    client = buildFakeOktaClient(
      {
        client_id: "clientId123",
        client_secret: "secretXyz",
        settings: {
          oauthClient: {
            redirect_uris: ["http://localhost:8080/oauth/redirect"],
          },
        },
      },
      getAuthorizationServerInfoMock,
      userCollection,
      token
    );
    let response = await new AuthorizationCodeStrategy(
      req,
      logger,
      redirect_uri,
      client
    ).getToken();
    expect(response).toBe(token);
  });

  it("Authorization Server Client Throws Error Fetching Grant.", async () => {
    client = buildFakeOktaClient(
      {
        client_id: "clientId123",
        client_secret: "secretXyz",
        settings: {
          oauthClient: {
            redirect_uris: ["http://localhost:8080/oauth/redirect"],
          },
        },
      },
      getAuthorizationServerInfoMock,
      userCollection
    );
    try {
      await new AuthorizationCodeStrategy(
        req,
        logger,
        redirect_uri,
        client
      ).getToken();
      fail("Auth client error should be thrown");
    } catch (err) {
      expect(err.error).toBe("error");
      expect(err.error_description).toBe("error_description");
      return;
    }
  });
});
