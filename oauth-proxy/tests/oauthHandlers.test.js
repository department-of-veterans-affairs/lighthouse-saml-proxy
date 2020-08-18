"use strict";

require("jest");

const MockExpressRequest = require("mock-express-request");
const MockExpressResponse = require("mock-express-response");
const { TokenSet } = require("openid-client");
const { RequestError } = require("request-promise-native/errors");
const timekeeper = require("timekeeper");

const {
  tokenHandler,
  authorizeHandler,
  redirectHandler,
  revokeUserGrantHandler,
} = require("../oauthHandlers");
const { translateTokenSet } = require("../oauthHandlers/tokenResponse");
const { encodeBasicAuthHeader } = require("../utils");
const { convertObjectToDynamoAttributeValues } = require("./testUtils");
const oktaApiClient = require("../apiClients/oktaApiClient");
jest.mock("../apiClients/oktaApiClient");
const deleteUserGrantOnClientMock = oktaApiClient.deleteUserGrantOnClient;
const getClientInfoMock = oktaApiClient.getClientInfo;
const getUserInfoMock = oktaApiClient.getUserInfo;
const getAuthorizationServerInfo = oktaApiClient.getAuthorizationServerInfo;

function buildFakeDynamoClient(fakeDynamoRecord) {
  const dynamoClient = jest.genMockFromModule("../dynamo_client.js");
  dynamoClient.saveToDynamo.mockImplementation((state) => {
    return new Promise((resolve) => {
      // It's unclear whether this should resolve with a full records or just
      // the identity field but thus far it has been irrelevant to the
      // functional testing of the oauth-proxy.
      resolve({ pk: state });
    });
  });
  dynamoClient.getFromDynamoBySecondary.mockImplementation(
    (handle, attr, value) => {
      return new Promise((resolve, reject) => {
        if (fakeDynamoRecord[attr] === value) {
          resolve(convertObjectToDynamoAttributeValues(fakeDynamoRecord));
        } else {
          reject(`no such ${attr} value`);
        }
      });
    }
  );
  dynamoClient.getFromDynamoByState.mockImplementation((handle, state) => {
    return new Promise((resolve, reject) => {
      if (state === fakeDynamoRecord.state) {
        resolve(convertObjectToDynamoAttributeValues(fakeDynamoRecord));
      } else {
        reject("no such state value");
      }
    });
  });
  return dynamoClient;
}

class FakeIssuer {
  constructor(client) {
    this.Client = class FakeInlineClient {
      constructor() {
        return client;
      }
    };
    this.metadata = {
      issuer: "https://fake.okta.com/oauth2/1234",
      authorization_endpoint: "fake_enpoint",
    };
  }
}

describe("translateTokenSet", () => {
  it("omits id_token if not in TokenSet", async () => {
    const oauth_only_set = new TokenSet({
      access_token: "oauth.is.cool",
      refresh_token: "refresh.later",
      expires_in: 3600,
    });
    const translated = translateTokenSet(oauth_only_set);
    expect(translated).not.toHaveProperty("id_token");
  });

  it("copies id_token for OIDC", async () => {
    const fake_id_token = "oidc.is.cool";
    const oidc_set = new TokenSet({
      access_token: "oauth.is.cool",
      refresh_token: "refresh.later",
      id_token: fake_id_token,
      expires_in: 3600,
    });

    const translated = translateTokenSet(oidc_set);
    expect(translated).toHaveProperty("id_token");
    expect(translated.id_token).toEqual(fake_id_token);
  });

  it("translates absolute timestamps to relative timestamps", async () => {
    try {
      timekeeper.freeze(Date.now());
      const abs_oauth_set = new TokenSet({
        access_token: "oauth.is.cool",
        refresh_token: "refresh.later",
        expires_in: 7200,
      });
      const now_sec = Math.floor(Date.now() / 1000);
      expect(abs_oauth_set.expires_at - now_sec).toEqual(7200);

      const translated = translateTokenSet(abs_oauth_set);
      expect(translated).toHaveProperty("expires_in");
      expect(translated.expires_in).toEqual(7200);
    } finally {
      timekeeper.reset();
    }
  });
});

let buildOpenIDClient = (fns) => {
  let client = {};
  for (let [fn_name, fn_impl] of Object.entries(fns)) {
    client[fn_name] = jest.fn().mockImplementation(async () => {
      return new Promise((resolve, reject) => {
        fn_impl(resolve, reject);
      });
    });
  }
  return client;
};

let buildExpiredRefreshTokenClient = () => {
  return buildOpenIDClient({
    refresh: () => {
      // This simulates an upstream error so that we don't have to test the full handler.
      throw new RequestError(
        new Error(
          "simulated upstream response error for expired refresh token"
        ),
        {},
        { statusCode: 400 }
      );
    },
  });
};

function buildFakeOktaClient(fakeRecord) {
  const oktaClient = { getApplication: jest.fn() };
  oktaClient.getApplication.mockImplementation((client_id) => {
    return new Promise((resolve, reject) => {
      if (client_id === fakeRecord.client_id) {
        resolve(fakeRecord);
      } else {
        reject(`no such client application '${client_id}'`);
      }
    });
  });
  return oktaClient;
}

let buildFakeGetAuthorizationServerInfoResponse = (audiences) => {
  return {
    id: "id",
    name: "name",
    description: "description",
    audiences: audiences,
    issuer: "https://fake.okta.com/oauth2/1234",
    issuerMode: "ORG_URL",
    status: "ACTIVE",
    created: "2000-01-01T00:00:00.000Z",
    lastUpdated: "2000-01-01T00:00:00.000Z",
    credentials: {
      signing: {
        rotationMode: "AUTO",
        lastRotated: "2000-01-01T00:00:00.000Z",
        nextRotation: "2000-01-01T00:00:00.000Z",
        kid: "kid",
      },
    },
    _links: {
      rotateKey: {
        href: "https://fake.okta.com/oauth2/1234/keyRotate",
        hints: {
          allow: ["POST"],
        },
      },
      metadata: [
        {
          name: "oauth-authorization-server",
          href:
            "https://fake.okta.com/oauth2/1234/.well-known/oauth-authorization-server",
          hints: {
            allow: ["GET"],
          },
        },
        {
          name: "openid-configuration",
          href:
            "https://fake.okta.com/oauth2/1234/.well-known/openid-configuration",
          hints: {
            allow: ["GET"],
          },
        },
      ],
      keys: {
        href:
          "https://fake.okta.com/oauth2/1234/api/v1/authorizationServers/default/credentials/keys",
        hints: {
          allow: ["GET"],
        },
      },
      claims: {
        href:
          "https://fake.okta.com/oauth2/1234/api/v1/authorizationServers/default/claims",
        hints: {
          allow: ["GET", "POST"],
        },
      },
      policies: {
        href:
          "https://fake.okta.com/oauth2/1234/api/v1/authorizationServers/default/policies",
        hints: {
          allow: ["GET", "POST"],
        },
      },
      self: {
        href:
          "https://fake.okta.com/oauth2/1234/api/v1/authorizationServers/default",
        hints: {
          allow: ["GET", "DELETE", "PUT"],
        },
      },
      scopes: {
        href:
          "https://fake.okta.com/oauth2/1234/api/v1/authorizationServers/default/scopes",
        hints: {
          allow: ["GET", "POST"],
        },
      },
      deactivate: {
        href:
          "https://fake.okta.com/oauth2/1234/api/v1/authorizationServers/default/lifecycle/deactivate",
        hints: {
          allow: ["POST"],
        },
      },
    },
  };
};
let config;
let redirect_uri;
let issuer;
let logger;
let dynamo;
let dynamoClient;
let validateToken;
let next;
let oktaClient;
let req;
let res;

beforeEach(() => {
  config = jest.mock();
  redirect_uri = jest.mock();
  issuer = jest.mock();
  logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  dynamo = jest.mock();
  dynamoClient = jest.mock();
  validateToken = jest.fn();
  next = jest.fn();
  req = new MockExpressRequest();
  res = new MockExpressResponse();

  oktaClient = buildFakeOktaClient({
    client_id: "clientId123",
    client_secret: "secretXyz",
    settings: {
      oauthClient: {
        redirect_uris: ["http://localhost:8080/oauth/redirect"],
      },
    },
  });

  dynamoClient = buildFakeDynamoClient({
    state: "abc123",
    code: "the_fake_authorization_code",
    refresh_token: "",
    redirect_uri: "http://localhost/thisDoesNotMatter",
  });

  issuer = new FakeIssuer(dynamoClient);
});

describe("tokenHandler", () => {
  afterEach(() => {
    // expressjs requires that all handlers call next() unless they want to
    // stop the remaining middleware from running. Since the remaining
    // middleware is defined by the application, this should not be done by the
    // tokenHandler at all.
    expect(next).toHaveBeenCalled();
  });

  it("handles the authorization_code flow", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "authorization_code",
        code: "the_fake_authorization_code",
        client_id: "client123",
        client_secret: "secret789",
      },
    });
    dynamoClient = buildFakeDynamoClient({
      state: "abc123",
      code: "the_fake_authorization_code",
      refresh_token: "",
      redirect_uri: "http://localhost/thisDoesNotMatter",
    });
    validateToken = () => {
      return { va_identifiers: { icn: "0000000000000" } };
    };
    let res = new MockExpressResponse();
    let client = buildOpenIDClient({
      grant: (resolve) => {
        resolve(
          new TokenSet({
            access_token:
              "eyJraWQiOiJDcnNSZDNpYnhIMUswSl9WYWd0TnlHaER2cFlRN0hLdVd6NFFibk5IQmlBIiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULk41Qlg4d3RXN01jSlp4ZDlqX0FfLVozVFA1LWI5Mk5fZ3E1MXRMY2w1VXcuUUFjTlo1d3JpL1ZhMUx4UGZ4b2ZjU3RvbkpKMnM0b0d0SzI5RDZFdGpsRT0iLCJpc3MiOiJodHRwczovL2RlcHR2YS1ldmFsLm9rdGEuY29tL29hdXRoMi9kZWZhdWx0IiwiYXVkIjoiYXBpOi8vZGVmYXVsdCIsImlhdCI6MTU3ODU4NTQ1MSwiZXhwIjoxNTc4NTg5MDUxLCJjaWQiOiIwb2EzNXJsYjhwdEh1bGVGZjJwNyIsInVpZCI6IjAwdTJwOWZhcjRpaERBRVg4MnA3Iiwic2NwIjpbIm9mZmxpbmVfYWNjZXNzIiwicGF0aWVudC9QYXRpZW50LnJlYWQiLCJsYXVuY2gvcGF0aWVudCIsInZldGVyYW5fc3RhdHVzLnJlYWQiLCJvcGVuaWQiLCJwcm9maWxlIl0sInN1YiI6ImNmYTMyMjQ0NTY5ODQxYTA5MGFkOWQyZjA1MjRjZjM4In0.NN8kTau8BKOycr_8BQKvV9_BnNgXjC1LkP2f85lTKcz8n1soAXqcfDJpDpndt7ihGgdd7AbDQIwaQwW6j9NPg9wr98G7kPfaFNIqJTsjj1FvHw9kwIK74l1CB0nQoRs-Yl-g26c6Z9fvOkSsTbFzGwFoTLp3dox6-vt18C5ql8vfPyNyooIZ9C1V2myEtYgoKpWHH1mx_Sx1ySRInuIOsoUYFJmRw87BMbb9F3n_IF377hJNy9tVNJFS78O9ZvnFWzUOQsx5qCtMGRkHEQFRQsK4Zo8Nd-Gc1_rjVwklfDeQlNd2uPEklGkbxCEZd2rIuWU4fIPPkENN6TKrVUtzjg",
            expires_in: 60,
          })
        );
      },
    });
    issuer = new FakeIssuer(client);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      req,
      res,
      next
    );
    expect(client.grant).toHaveBeenCalled();
    expect(res.statusCode).toEqual(200);
  });

  it("handles the refresh flow", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "refresh_token",
        refresh_token: "the_fake_refresh_token",
        client_id: "client123",
        client_secret: "secret789",
      },
    });
    dynamoClient = buildFakeDynamoClient({
      state: "abc123",
      code: "xyz789",
      refresh_token: "the_fake_refresh_token",
      redirect_uri: "http://localhost/thisDoesNotMatter",
    });
    validateToken = () => {
      return { va_identifiers: { icn: "0000000000000" } };
    };
    let res = new MockExpressResponse();
    let client = buildOpenIDClient({
      refresh: (resolve) => {
        resolve(
          new TokenSet({
            access_token:
              "eyJraWQiOiJDcnNSZDNpYnhIMUswSl9WYWd0TnlHaER2cFlRN0hLdVd6NFFibk5IQmlBIiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULk41Qlg4d3RXN01jSlp4ZDlqX0FfLVozVFA1LWI5Mk5fZ3E1MXRMY2w1VXcuUUFjTlo1d3JpL1ZhMUx4UGZ4b2ZjU3RvbkpKMnM0b0d0SzI5RDZFdGpsRT0iLCJpc3MiOiJodHRwczovL2RlcHR2YS1ldmFsLm9rdGEuY29tL29hdXRoMi9kZWZhdWx0IiwiYXVkIjoiYXBpOi8vZGVmYXVsdCIsImlhdCI6MTU3ODU4NTQ1MSwiZXhwIjoxNTc4NTg5MDUxLCJjaWQiOiIwb2EzNXJsYjhwdEh1bGVGZjJwNyIsInVpZCI6IjAwdTJwOWZhcjRpaERBRVg4MnA3Iiwic2NwIjpbIm9mZmxpbmVfYWNjZXNzIiwicGF0aWVudC9QYXRpZW50LnJlYWQiLCJsYXVuY2gvcGF0aWVudCIsInZldGVyYW5fc3RhdHVzLnJlYWQiLCJvcGVuaWQiLCJwcm9maWxlIl0sInN1YiI6ImNmYTMyMjQ0NTY5ODQxYTA5MGFkOWQyZjA1MjRjZjM4In0.NN8kTau8BKOycr_8BQKvV9_BnNgXjC1LkP2f85lTKcz8n1soAXqcfDJpDpndt7ihGgdd7AbDQIwaQwW6j9NPg9wr98G7kPfaFNIqJTsjj1FvHw9kwIK74l1CB0nQoRs-Yl-g26c6Z9fvOkSsTbFzGwFoTLp3dox6-vt18C5ql8vfPyNyooIZ9C1V2myEtYgoKpWHH1mx_Sx1ySRInuIOsoUYFJmRw87BMbb9F3n_IF377hJNy9tVNJFS78O9ZvnFWzUOQsx5qCtMGRkHEQFRQsK4Zo8Nd-Gc1_rjVwklfDeQlNd2uPEklGkbxCEZd2rIuWU4fIPPkENN6TKrVUtzjg",
            refresh_token: "the_fake_refresh_token",
            expires_in: 60,
          })
        );
      },
    });
    issuer = new FakeIssuer(client);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      req,
      res,
      next
    );
    expect(client.refresh).toHaveBeenCalled();
    expect(res.statusCode).toEqual(200);
  });

  it("supports client_secret_basic authentication", async () => {
    let req = new MockExpressRequest({
      headers: {
        authorization: encodeBasicAuthHeader("client123", "secret789"),
      },
      body: {
        grant_type: "refresh_token",
        refresh_token: "the_fake_refresh_token",
      },
    });
    let res = new MockExpressResponse();
    let client = buildExpiredRefreshTokenClient();
    issuer = new FakeIssuer(client);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      req,
      res,
      next
    );
    expect(client.refresh).toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
  });

  it("supports client_secret_post authentication", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "refresh_token",
        refresh_token: "the_fake_refresh_token",
        client_id: "client123",
        client_secret: "secret789",
      },
    });
    let res = new MockExpressResponse();
    let client = buildExpiredRefreshTokenClient();
    issuer = new FakeIssuer(client);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      req,
      res,
      next
    );
    expect(client.refresh).toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
  });

  it("supports none (PKCE) authentication", async () => {
    let customConfig = { ...config, enable_pkce_authorization_flow: true };
    let req = new MockExpressRequest({
      body: {
        grant_type: "refresh_token",
        refresh_token: "the_fake_refresh_token",
        client_id: "client123",
      },
    });
    let res = new MockExpressResponse();
    let client = buildExpiredRefreshTokenClient();
    issuer = new FakeIssuer(client);
    await tokenHandler(
      customConfig,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      req,
      res,
      next
    );
    expect(client.refresh).toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
  });

  it("errors properly for unauthorized (blank) requests", async () => {
    let req = new MockExpressRequest({
      method: "POST",
      url: "/oauth2/token",
      body: {},
    });
    let res = new MockExpressResponse();
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      req,
      res,
      next
    );
    expect(validateToken).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(401);
  });

  it("errors properly for unauthorized (no client_secret) requests", async () => {
    let customConfig = { ...config, enable_pkce_authorization_flow: false };
    let req = new MockExpressRequest({
      method: "POST",
      url: "/oauth2/token",
      body: {
        grant_type: "refresh_token",
        refresh_token: "the_fake_refresh_token",
        client_id: "client123",
      },
    });
    let res = new MockExpressResponse();
    await tokenHandler(
      customConfig,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      req,
      res,
      next
    );
    expect(validateToken).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(401);
  });
});

describe("authorizeHandler", () => {
  afterEach(() => {});

  beforeEach(() => {
    getAuthorizationServerInfo.mockReset();
  });

  it("Happy Path Redirect", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfo.mockResolvedValue(response);
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
    };

    await authorizeHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      oktaClient,
      req,
      res,
      next
    );
    expect(res.redirect).toHaveBeenCalled();
  });

  it("Happy Path Redirect with Aud parameter", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfo.mockResolvedValue(response);
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
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      oktaClient,
      req,
      res,
      next
    );
    expect(res.redirect).toHaveBeenCalled();
  });

  it("Aud parameter does not match API response, redirect -> until we implement", async () => {
    let response = buildFakeGetAuthorizationServerInfoResponse(["aud"]);
    getAuthorizationServerInfo.mockResolvedValue(response);

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
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      oktaClient,
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

  it("getAuthorizationServerInfo Error, return 500", async () => {
    getAuthorizationServerInfo.mockRejectedValue({ error: "fakeError" });

    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "http://localhost:8080/oauth/redirect",
      aud: "notAPIValue",
    };

    await authorizeHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      oktaClient,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(500);
  });

  it("No state, returns 400", async () => {
    await authorizeHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      oktaClient,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
  });

  it("State is empty, returns 400", async () => {
    req.query = { state: null };
    await authorizeHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      oktaClient,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
  });

  it("Bad redirect_uri", async () => {
    req.query = {
      state: "fake_state",
      client_id: "clientId123",
      redirect_uri: "https://www.google.com",
    };

    await authorizeHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      oktaClient,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
  });
});

describe("redirectHandler", () => {
  afterEach(() => {});

  it("Happy Path Redirect", async () => {
    res = {
      redirect: jest.fn(),
    };

    req.query = {
      state: "abc123",
    };

    await redirectHandler(logger, dynamo, dynamoClient, req, res, next);
    expect(res.redirect).toHaveBeenCalled();
  });

  it("No state, returns 400", async () => {
    await redirectHandler(logger, dynamo, dynamoClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("State is empty, returns 400", async () => {
    req.query = { state: null };
    await redirectHandler(logger, dynamo, dynamoClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });
});

describe("revokeUserGrantHandler", () => {
  afterEach(() => {
    jest.unmock("../apiClients/oktaApiClient");
  });
  let res;
  let req;
  let config;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      enable_okta_consent_endpoint: true,
    };
    next = jest.fn();
    req = new MockExpressRequest();
    res = new MockExpressResponse();
    deleteUserGrantOnClientMock.mockReset();
    getClientInfoMock.mockReset();
    getUserInfoMock.mockReset();
  });

  it("Happy Path", async () => {
    deleteUserGrantOnClientMock.mockResolvedValue({ status: 200 });
    getClientInfoMock.mockResolvedValue({ client_id: "clientid123" });
    getUserInfoMock.mockResolvedValue({ data: [{ id: "id1" }, { id: "id2" }] });
    req.body = { client_id: "clientid123", email: "email@example.com" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(200);
  });

  it("Revoke Grants Turned Off", async () => {
    config = {
      enable_okta_consent_endpoint: false,
    };
    deleteUserGrantOnClientMock.mockResolvedValue({ status: 200 });
    req.body = { client_id: "clientid123", user_id: "userid123" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(403);
  });

  it("Client Id Empty", async () => {
    req.body = { client_id: "", user_id: "userid123" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Email Empty", async () => {
    req.body = { client_id: "clientid123", email: "" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Client Id Null", async () => {
    req.body = { user_id: "userid123" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Email Null", async () => {
    req.body = { client_id: "clientid123" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Invalid Client Id", async () => {
    deleteUserGrantOnClientMock.mockResolvedValue({ status: 200 });
    getClientInfoMock.mockResolvedValue({ client_id: "clientid123" });
    getUserInfoMock.mockResolvedValue({ data: [{ id: "id1" }, { id: "id2" }] });
    req.body = { client_id: "clientid123!", email: "email@example.com" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("No User Ids associated with Email", async () => {
    deleteUserGrantOnClientMock.mockResolvedValue({ status: 200 });
    getClientInfoMock.mockResolvedValue({ client_id: "clientid123" });
    getUserInfoMock.mockResolvedValue({ data: [] });
    req.body = { client_id: "clientid123", email: "email@example.com" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Invalid Email", async () => {
    deleteUserGrantOnClientMock.mockResolvedValue({ status: 200 });
    getClientInfoMock.mockResolvedValue({ client_id: "clientid123" });
    getUserInfoMock.mockResolvedValue({ data: [{ id: "id1" }, { id: "id2" }] });
    req.body = { client_id: "clientid123", email: "email@example" };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Email with additional filtering", async () => {
    deleteUserGrantOnClientMock.mockResolvedValue({ status: 200 });
    getClientInfoMock.mockResolvedValue({ client_id: "clientid123" });
    getUserInfoMock.mockResolvedValue({ data: [{ id: "id1" }, { id: "id2" }] });
    req.body = {
      client_id: "clientid123",
      email: 'email@example.com or firstName eq "John"',
    };
    await revokeUserGrantHandler(config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });
});
