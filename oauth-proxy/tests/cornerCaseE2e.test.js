"use strict";

require("jest");
const axios = require("axios");
const qs = require("qs");
const { Issuer } = require("openid-client");

const { buildFakeDynamoClient, buildFakeOktaClient } = require("./testUtils");
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

describe("OpenID Connect Conformance", () => {
  let oktaClient;
  let fakeDynamoClient;

  beforeAll(async () => {
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
      null,
      null,
      null
    );
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
      throw {};
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
      fail("token request should have thrown an error");
    } catch (err) {
      expect(err.response.headers["retry-after"]).toEqual("300");
      expect(err.response.status).toEqual(503);
    }
  });
});
