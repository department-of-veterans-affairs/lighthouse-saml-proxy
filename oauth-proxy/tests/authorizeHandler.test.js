"use strict";

require("jest");
const MockExpressRequest = require("mock-express-request");
const MockExpressResponse = require("mock-express-response");
const Collection = require("@okta/okta-sdk-nodejs/src/collection");
const ModelFactory = require("@okta/okta-sdk-nodejs/src/model-factory");
const User = require("@okta/okta-sdk-nodejs/src/models/User");
const { authorizeHandler } = require("../oauthHandlers");
const {
  FakeIssuer,
  buildFakeDynamoClient,
  buildFakeOktaClient,
  buildFakeGetAuthorizationServerInfoResponse,
} = require("./testUtils");
const getAuthorizationServerInfoMock = jest.fn();
const mockSlugHelper = {
  rewrite: jest.fn(),
};
mockSlugHelper.rewrite.mockImplementation((...slugs) => {
  for (const slug of slugs) {
    if (slug) {
      return slug;
    }
  }

  return null;
});
const userCollection = new Collection("", "", new ModelFactory(User));
userCollection.currentItems = [{ id: 1 }];
jest.mock("uuid", () => ({ v4: () => "0000-1111-2222-3333" }));

const badRedirectMessage = (badRedirect) => {
  return `The redirect URI specified by the application does not match any of the registered redirect URIs. Erroneous redirect URI: ${badRedirect}`;
};

let redirect_uri;
let issuer;
let logger;
let dynamoClient;
let next;
let oktaClient;
let req;
let res;
let api_category;

const buildRedirectErrorUri = (err, redirect_uri) => {
  let uri = new URL(redirect_uri);
  uri.searchParams.append("error", err.error);
  uri.searchParams.append("error_description", err.error_description);
  return uri;
};
beforeEach(() => {
  redirect_uri = jest.mock();
  issuer = jest.mock();
  logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  next = jest.fn();
  req = new MockExpressRequest({
    url: "/veteran-verification/v1/authorization",
  });
  res = new MockExpressResponse();
  res.redirect = jest.fn();
  res.json = jest.fn();
  api_category = {
    api_category: "/veteran-verification/v1",
    upstream_issuer: "https://deptva-eval.okta.com/oauth2/aus7y0sefudDrg2HI2p7",
  };

  oktaClient = buildFakeOktaClient(
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

  dynamoClient = buildFakeDynamoClient({
    state: "abc123",
    code: "the_fake_authorization_code",
    refresh_token: "",
    redirect_uri: "http://localhost/thisDoesNotMatter",
  });

  issuer = new FakeIssuer(dynamoClient);

  getAuthorizationServerInfoMock.mockReset();
});

describe("Happy Path", () => {
  it("Happy Path Redirect", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.redirect).toHaveBeenCalled();
  });

  it("Happy Path Redirect using slug", async () => {
    mockSlugHelper.rewrite.mockImplementation((slug) => {
      return slug === "friendlyidp" ? "uglyipdid" : slug;
    });

    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      idp: "friendlyidp",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.redirect).toHaveBeenCalledWith(
      "fake_endpoint?state=0000-1111-2222-3333&client_id=clientId123&redirect_uri=%5Bobject+Object%5D&idp=uglyipdid"
    );
  });

  it("Happy Path Redirect using config idp", async () => {
    mockSlugHelper.rewrite.mockImplementation(
      (slugFromParam, slugFromAuthzRoute, slugFromConfig) => {
        return slugFromConfig;
      }
    );

    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.redirect).toHaveBeenCalledWith(
      "fake_endpoint?state=0000-1111-2222-3333&client_id=clientId123&redirect_uri=%5Bobject+Object%5D&idp=idp1"
    );
  });

  it("Happy Path Redirect with Aud parameter", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      aud: "aud",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.redirect).toHaveBeenCalled();
  });

  it("Verify that context is saved for SMART launch", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      scope: "openid profile offline_access launch/patient",
      launch: "123V456",
      aud: "aud",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalled();
  });

  it("Verify that JWT context is saved for SMART launch", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      scope: "openid profile offline_access launch",
      launch:
        "ewogICJwYXRpZW50IjogIjEyMzRWNTY3OCIsCiAgImVuY291bnRlciI6ICI5ODc2LTU0MzItMTAwMCIKfQ==",
      aud: "aud",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalled();
  });

  it("Happy path auth with local client flag", async () => {
    dynamoClient = buildFakeDynamoClient({
      client_id: "clientId123",
      redirect_uris: { values: ["http://localhost:8080/oauth/redirect"] },
    });

    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };

    api_category.client_store = "local";

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(dynamoClient.getPayloadFromDynamo).toHaveBeenCalledWith(
      { client_id: "clientId123" },
      "Clients"
    );
  });
});

describe("Invalid Request", () => {
  it("Verify that empty string redirect_uri results in 400", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "",
      aud: "aud",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_request",
      error_description:
        "There was no redirect URI specified by the application.",
    });
    expect(next).toHaveBeenCalled();
  });

  it("Invalid client_id results in 400", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      client_id: "a.b",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "unauthorized_client",
      error_description:
        "The client specified by the application is not valid.",
    });
    expect(next).toHaveBeenCalled();
  });

  it("Verify that undefined redirect_uri results in 400", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      aud: "aud",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_request",
      error_description:
        "There was no redirect URI specified by the application.",
    });
    expect(next).toHaveBeenCalled();
  });

  it("Aud parameter does not match API response, redirect -> until we implement", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      aud: "notAPIValue",
    };

    res = {
      redirect: jest.fn(),
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(logger.warn).toHaveBeenCalledWith({
      message: "Unexpected audience",
      actual: req.query.aud,
      expected: response.audiences,
    });
    expect(res.redirect).toHaveBeenCalled();
  });

  it("No client_redirect, returns 400", async () => {
    req.query = {
      client_id: "clientId123",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_request",
      error_description:
        "There was no redirect URI specified by the application.",
    });
  });

  it("No state, redirect", async () => {
    req.query = {
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      aud: "notAPIValue",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.redirect).toHaveBeenCalledWith(
      buildRedirectErrorUri(
        {
          error: "invalid_request",
          error_description: "State parameter required",
        },
        "http://localhost:8080/oauth/redirect"
      ).toString()
    );
  });

  it("Should redirect error on invalid client_id", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      state: "fake_state",
      client_id: "invalid",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      aud: "aud",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "unauthorized_client",
      error_description:
        "The client specified by the application is not valid.",
    });
  });

  it("State is empty, redirects", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);

    req.query = {
      state: null,
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };
    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).toHaveBeenCalledWith(
      buildRedirectErrorUri(
        {
          error: "invalid_request",
          error_description: "State parameter required",
        },
        "http://localhost:8080/oauth/redirect"
      ).toString()
    );
  });

  it("Bad redirect_uri", async () => {
    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "https://www.example.bad.com",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_request",
      error_description: badRedirectMessage("https://www.example.bad.com"),
    });
  });

  it("Bad redirect_uri and missing state", async () => {
    req.query = {
      client_id: "clientId123",
      redirect_uri: "https://www.example.bad.com",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_request",
      error_description: badRedirectMessage("https://www.example.bad.com"),
    });
  });
  it("Invalid path in request", async () => {
    dynamoClient = buildFakeDynamoClient({
      client_id: "clientId123",
      redirect_uris: { values: ["http://localhost:8080/oauth/redirect"] },
    });

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/invalid/redirect",
    };
    api_category.client_store = "local";

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_request",
      error_description: badRedirectMessage(
        "http://localhost:8080/oauth/invalid/redirect"
      ),
    });
    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("Invalid redirect_uri in request, local client config", async () => {
    dynamoClient = buildFakeDynamoClient({
      client_id: "clientId123",
      redirect_uris: { values: ["http://localhost:8080/oauth/redirect"] },
    });

    res.redirect = jest.fn();

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/invalid/redirect",
    };
    api_category.client_store = "local";

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "invalid_request",
      error_description: badRedirectMessage(
        "http://localhost:8080/oauth/invalid/redirect"
      ),
    });
    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });
});

describe("Server Error", () => {
  //I am unsure of this functionality??
  it("getAuthorizationServerInfo Error, return 500", async () => {
    getAuthorizationServerInfoMock.mockRejectedValue({ error: "fakeError" });

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      aud: "notAPIValue",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    )
      .then(() => {
        fail("Error should bubble up");
      })
      .catch((err) => {
        expect(err.status).toBe(500);
      });

    expect(logger.error).toHaveBeenCalledWith(
      "Unable to get the authorization server."
    );
  });

  it("Error on save to dynamo", async () => {
    dynamoClient.savePayloadToDynamo = jest.fn().mockImplementation(() => {
      return new Promise((resolve, reject) => {
        // It's unclear whether this should resolve with a full records or just
        // the identity field but thus far it has been irrelevant to the
        // functional testing of the oauth-proxy.
        reject({
          error: "bad_things_error",
          error_description: "Bad things happen",
        });
      });
    });

    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfoMock.mockResolvedValue(response);
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    // Should this be handled???
    expect(res.redirect).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("Unauthorized Client", () => {
  it("Invalid client in request, local client config, mimic no db table", async () => {
    dynamoClient = buildFakeDynamoClient({
      client_id: "clientId123xxxx",
      redirect_uris: { values: ["http://localhost:8080/oauth/redirect"] },
    });

    res.redirect = jest.fn();

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };
    api_category.client_store = "local";

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "unauthorized_client",
      error_description:
        "The client specified by the application is not valid.",
    });
    expect(dynamoClient.getPayloadFromDynamo).toHaveBeenCalledWith(
      { client_id: "clientId123" },
      "Clients"
    );
  });

  it("Invalid client in request, local client config, empty response from db", async () => {
    api_category.client_store = "local";
    dynamoClient = buildFakeDynamoClient({
      client_id: "clientId123xxxx",
      redirect_uris: { values: ["http://localhost:8080/oauth/redirect"] },
    });

    dynamoClient.getPayloadFromDynamo = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolve({});
      });
    });

    res.redirect = jest.fn();

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };
    api_category.client_store = "local";

    await authorizeHandler(
      redirect_uri,
      logger,
      issuer,
      dynamoClient,
      oktaClient,
      mockSlugHelper,
      api_category,
      "OAuthRequestsV2",
      "Clients",
      "idp1",
      req,
      res,
      next
    );

    expect(res.redirect).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "unauthorized_client",
      error_description:
        "The client specified by the application is not valid.",
    });
    expect(dynamoClient.getPayloadFromDynamo).toHaveBeenCalledWith(
      { client_id: "clientId123" },
      "Clients"
    );
  });
});
