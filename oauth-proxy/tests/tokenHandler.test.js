require("jest");
const MockExpressRequest = require("mock-express-request");
const MockExpressResponse = require("mock-express-response");
const { TokenSet } = require("openid-client");
const { tokenHandler } = require("../oauthHandlers");
const { encodeBasicAuthHeader } = require("../utils");
const {
  FakeIssuer,
  buildFakeDynamoClient,
  buildOpenIDClient,
  buildExpiredRefreshTokenClient,
} = require("./testUtils");

let config;
let redirect_uri;
let issuer;
let logger;
let dynamo;
let dynamoClient;
let next;
let validateToken;
let staticTokens;

beforeEach(() => {
  config = jest.mock();
  redirect_uri = jest.mock();
  issuer = jest.mock();
  logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  dynamo = jest.mock();
  dynamoClient = jest.mock();
  validateToken = jest.fn();
  staticTokens = new Map();
  next = jest.fn();

  config.dynamo_static_token_table = "ut_static_tokens_table";
  dynamo.dbDocClient = {
    get: (search_params, result) => {
      if (
        search_params.Key.static_refresh_token ===
        "the_fake_static_refresh_token"
      ) {
        result(false, {
          Item: {
            static_access_token: "the_fake_static_access_token",
            static_refresh_token: "the_fake_static_refresh_token",
            static_expires_in: 1500,
            static_icn: "the_fake_static_icn",
          },
        });
      } else {
        result(false, undefined);
      }
    },
  };

  dynamoClient = buildFakeDynamoClient({
    state: "abc123",
    code: "the_fake_authorization_code",
    refresh_token: "",
    redirect_uri: "http://localhost/thisDoesNotMatter",
  });

  issuer = new FakeIssuer(dynamoClient);
});

afterEach(() => {
  // expressjs requires that all handlers call next() unless they want to
  // stop the remaining middleware from running. Since the remaining
  // middleware is defined by the application, this should not be done by the
  // tokenHandler at all.
  expect(next).toHaveBeenCalled();
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

    let res = new MockExpressResponse();
    issuer = new FakeIssuer(dynamoClient);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(200);
  });

  it("handles invalid client_credentials request", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "client_credentials",
        client_assertion: "tbd",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    let res = new MockExpressResponse();
    issuer = new FakeIssuer(dynamoClient);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      null,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
  });

  it("handles invalid request with no grant_type", async () => {
    let req = new MockExpressRequest({
      body: {
        client_assertion: "tbd",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    let res = new MockExpressResponse();
    issuer = new FakeIssuer(dynamoClient);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      null,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
  });

  it("handles invalid request with invalid grant_type", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "invalid",
        client_assertion: "tbd",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      },
    });

    let res = new MockExpressResponse();
    issuer = new FakeIssuer(dynamoClient);
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      null,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(400);
  });
});

describe("tokenHandler refresh", () => {
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
      staticTokens,
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
      staticTokens,
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
      staticTokens,
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
      staticTokens,
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
      body: { grant_type: "refresh_token" },
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
      staticTokens,
      req,
      res,
      next
    );
    expect(validateToken).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(401);
  });

  it("Unsupported Grant Type Error", async () => {
    let req = new MockExpressRequest({
      method: "POST",
      url: "/oauth2/token",
      body: {
        grant_type: "unsupported_grant_type",
        client_id: "client123",
        client_secret: "secret789",
      },
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
      staticTokens,
      req,
      res,
      next
    );
    expect(validateToken).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(400);
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
      staticTokens,
      req,
      res,
      next
    );
    expect(validateToken).not.toHaveBeenCalled();
    expect(res.statusCode).toEqual(401);
  });
  it("handles the static token refresh flow", async () => {
    let req = new MockExpressRequest({
      body: {
        grant_type: "refresh_token",
        refresh_token: "static-refresh-token",
        client_id: "client123",
        client_secret: "secret789",
      },
    });
    dynamoClient = buildFakeDynamoClient({
      state: "abc123",
      code: "xyz789",
      refresh_token: "static-refresh-token",
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
            access_token: "static-access-token",
            refresh_token: "static-refresh-token",
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
      staticTokens,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(200);
  });
});

describe("tokenHandler code", () => {
  let req;
  let res;
  let client;
  beforeEach(() => {
    req = new MockExpressRequest({
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
    res = new MockExpressResponse();
    client = buildOpenIDClient({
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
  });
  it("handles the authorization_code flow", async () => {
    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      staticTokens,
      req,
      res,
      next
    );
    expect(client.grant).toHaveBeenCalled();
    expect(res.statusCode).toEqual(200);
  });

  it("Client Grant Error", async () => {
    client.grant = () => {
      throw new Error("error");
    };

    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(500);
  });

  it("invalid_client error", async () => {
    client.grant = () => {
      throw {
        error: "expected 200 OK, got: 401 Unauthorized",
        error_description: "Could not authorize client_id",
        response: {
          statusCode: 401,
        },
      };
    };

    await tokenHandler(
      config,
      redirect_uri,
      logger,
      issuer,
      dynamo,
      dynamoClient,
      validateToken,
      staticTokens,
      req,
      res,
      next
    );
    expect(res.statusCode).toEqual(401);
  });
});
