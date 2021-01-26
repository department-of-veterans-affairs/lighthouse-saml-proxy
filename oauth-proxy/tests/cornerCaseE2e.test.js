"use strict";

require("jest");
const axios = require("axios");
const qs = require("qs");
const { Issuer } = require("openid-client");

const { convertObjectToDynamoAttributeValues } = require("./testUtils");
const {
  buildBackgroundServerModule,
} = require("../../common/backgroundServer");
const upstreamOAuthTestServer = require("./upstreamOAuthTestServer");
const {
  startServerInBackground,
  stopBackgroundServer,
} = buildBackgroundServerModule("oauth-proxy test app");
const { buildApp } = require("../index");
const { encodeBasicAuthHeader } = require("../utils");

beforeAll(() => {
  upstreamOAuthTestServer.start();
});

afterAll(() => {
  upstreamOAuthTestServer.stop();
});

const TEST_SERVER_PORT = 9090;
const FAKE_CLIENT_APP_REDIRECT_URL = "http://localhost:8080/oauth/redirect";
const FAKE_CLIENT_APP_URL_PATTERN = /http:[/][/]localhost:8080.*/;
const defaultTestingConfig = {
  host: `http://localhost:${TEST_SERVER_PORT}`,
  well_known_base_path: "/testServer",
  upstream_issuer: upstreamOAuthTestServer.baseUrl(),
  validate_post_endpoint: "http://localhost",
  validate_apiKey: "fakeApiKey",
  manage_endpoint: "http://localhost:9091/account",
  hmac_secret: "testsecret",
  dynamo_client_credentials_table: "client_creds_table",
  enable_smart_launch_service: true,
  enable_static_token_service: true,
  routes: {
    categories: [
      {
        api_category: "/veteran-verification-apis/v1",
        upstream_issuer: upstreamOAuthTestServer.baseUrl(),
      },
      {
        api_category: "",
        upstream_issuer: upstreamOAuthTestServer.baseUrl(),
      },
    ],
    app_routes: {
      authorize: "/authorization",
      token: "/token",
      userinfo: "/userinfo",
      introspection: "/introspect",
      manage: "/manage",
      revoke: "/revoke",
      jwks: "/keys",
      redirect: "/redirect",
      grants: "/grants",
      smart_launch: "/smart/launch",
    },
  },
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

function buildFakeDynamoClient(fakeDynamoClientRecord) {
  const fakeDynamoClient = {};
  fakeDynamoClient.updateToDynamo = (tok) => {
    return new Promise((resolve) => {
      // It's unclear whether this should resolve with a full records or just
      // the identity field but thus far it has been irrelevant to the
      // functional testing of the oauth-proxy.
      resolve({ pk: tok.state });
    });
  };
  fakeDynamoClient.queryFromDynamo = (queryParams, tableName) => {
    return new Promise((resolve, reject) => {
      if (
        fakeDynamoClientRecord &&
        fakeDynamoClientRecord[Object.keys(queryParams)[0]] ===
          Object.values(queryParams)[0]
      ) {
        resolve(convertObjectToDynamoAttributeValues(fakeDynamoClientRecord));
      } else {
        reject(`no such ${queryParams} value on ${tableName}`);
      }
    });
  };
  fakeDynamoClient.getPayloadFromDynamo = (search_params, tableName) => {
    const hashed_smart_launch_token =
      "ab29a92e1db44913c896efeed12108faa0b47a944b56cd7cd07d121aefa3769a";
    const fakeLaunchRecord = {
      launch: "123V456",
    };
    return new Promise((resolve, reject) => {
      let searchKey = Object.keys(search_params)[0];
      if (
        tableName === "client_creds_table" &&
        searchKey === "access_token" &&
        search_params[searchKey] === hashed_smart_launch_token
      ) {
        fakeDynamoClientRecord.access_token = hashed_smart_launch_token;
        resolve({ Item: fakeLaunchRecord });
      } else if (
        search_params[searchKey] === fakeDynamoClientRecord[searchKey]
      ) {
        resolve({ Item: fakeDynamoClientRecord });
      } else {
        reject(`no such state value on ${tableName}`);
      }
    });
  };
  fakeDynamoClient.savePayloadToDynamo = (payload) => {
    return new Promise((resolve) => {
      // It's unclear whether this should resolve with a full records or just
      // the identity field but thus far it has been irrelevant to the
      // functional testing of the oauth-proxy.
      resolve({ payload });
    });
  };
  return fakeDynamoClient;
}

describe("OpenID Connect Conformance", () => {
  let oktaClient;
  let fakeDynamoClient;

  beforeAll(async () => {
    oktaClient = buildFakeOktaClient({
      client_id: "clientId123",
      client_secret: "secretXyz",
      settings: {
        oauthClient: {
          redirect_uris: ["http://localhost:8080/oauth/redirect"],
        },
      },
    });
    const isolatedIssuers = {};
    const isolatedOktaClients = {};
    if (defaultTestingConfig.routes && defaultTestingConfig.routes.categories) {
      for (const service_config of defaultTestingConfig.routes.categories) {
        isolatedIssuers[service_config.api_category] = await Issuer.discover(
          upstreamOAuthTestServer.baseUrl()
        );
        isolatedOktaClients[service_config.api_category] = oktaClient;
      }
    }
    fakeDynamoClient = buildFakeDynamoClient({
      state: "abc123",
      code: "xyz789",
      refresh_token: "jkl456",
      redirect_uri: FAKE_CLIENT_APP_REDIRECT_URL,
    });

    const fakeTokenValidator = () => {
      throw { };
    };

    const app = buildApp(
      defaultTestingConfig,
      oktaClient,
      fakeDynamoClient,
      fakeTokenValidator,
      isolatedIssuers,
      isolatedOktaClients
    );
    // We're starting and stopping this server in a beforeAll/afterAll pair,
    // rather than beforeEach/afterEach because this is an end-to-end
    // functional. Since internal application state could affect functionality
    // in production, we want to expose these tests to that same risk.
    startServerInBackground(app, TEST_SERVER_PORT);
  });

  afterAll(() => {
    stopBackgroundServer();
  });

  it("Token Validation Error", async () => {
    try {
      await axios.post(
        "http://localhost:9090/testServer/token",
        qs.stringify({ grant_type: "authorization_code", code: "xzy789" }),
        {
          headers: {
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      );
      fail("token request should have thrown an error")
    } catch (err) {
      expect(err.response.status).toEqual(503)
    }
  });
});
