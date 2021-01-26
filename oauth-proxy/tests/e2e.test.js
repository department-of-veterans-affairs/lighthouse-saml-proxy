"use strict";

require("jest");
const axios = require("axios");
const qs = require("qs");
const { Issuer } = require("openid-client");
const { randomBytes } = require("crypto");

const {
  convertObjectToDynamoAttributeValues,
  buildFakeOktaClient,
} = require("./testUtils");
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
  const testServerBaseUrlPattern = new RegExp(
    `^${defaultTestingConfig.host}${defaultTestingConfig.well_known_base_path}.*`
  );
  const upstreamOAuthTestServerBaseUrlPattern = new RegExp(
    `^${upstreamOAuthTestServer.baseUrl()}.*`
  );

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
      return {
        va_identifiers: {
          icn: "0000000000000",
        },
      };
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

  it("allows CORS on the OIDC metadata endpoint", async () => {
    const randomHeaderName = randomBytes(20).toString("hex");
    const options = {
      headers: {
        origin: "http://localhost:8080",
        "access-control-request-headers": randomHeaderName,
      },
    };
    const resp = await axios.options(
      "http://localhost:9090/testServer/.well-known/openid-configuration",
      options
    );
    expect(resp.status).toEqual(200);
    expect(resp.headers["access-control-allow-headers"]).toMatch(
      randomHeaderName
    );
    expect(resp.headers["access-control-allow-origin"]).toMatch(
      FAKE_CLIENT_APP_URL_PATTERN
    );
  });

  it("responds to the endpoints described in the OIDC metadata response", async (done) => {
    // This test is making multiple requests. Theoretically it could be broken
    // up, with each request being made in a separate test. That would make it
    // much more difficult to use the metadata response to drive the requests
    // for the subsequent requests.
    const resp = await axios.get(
      "http://localhost:9090/testServer/.well-known/openid-configuration"
    );
    const parsedMeta = resp.data;
    expect(parsedMeta).toMatchObject({
      authorization_endpoint: expect.any(String),
      token_endpoint: expect.any(String),
      userinfo_endpoint: expect.any(String),
      jwks_uri: expect.any(String),
    });

    expect(parsedMeta).toMatchObject({
      jwks_uri: expect.stringMatching(testServerBaseUrlPattern),
      authorization_endpoint: expect.stringMatching(testServerBaseUrlPattern),
      userinfo_endpoint: expect.stringMatching(testServerBaseUrlPattern),
      token_endpoint: expect.stringMatching(testServerBaseUrlPattern),
      introspection_endpoint: expect.stringMatching(testServerBaseUrlPattern),
    });

    await axios.get(parsedMeta.jwks_uri);
    await axios.get(parsedMeta.userinfo_endpoint);
    axios.post(parsedMeta.introspection_endpoint);

    const authorizeConfig = {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 500;
      },
      params: {
        client_id: "clientId123",
        state: "abc123",
        redirect_uri: "http://localhost:8080/oauth/redirect",
      },
    };
    const authorizeResp = await axios.get(
      parsedMeta.authorization_endpoint,
      authorizeConfig
    );
    expect(authorizeResp.status).toEqual(302);
    expect(authorizeResp.headers["location"]).toMatch(
      upstreamOAuthTestServerBaseUrlPattern
    );

    await axios.post(
      parsedMeta.token_endpoint,
      qs.stringify({ grant_type: "authorization_code", code: "xzy789" }),
      {
        auth: { username: "clientId123", password: "secretXyz" },
      }
    );
    done();
    // TODO: We should really call the token endpoint using the refresh_token
    // grant type here. Right now the openid-client library makes this a little
    // difficult. It automatically verifies the signature of the new access
    // token. That's great, but doing full e2e testing would require making the
    // upstream test server support constructing and signing proper JWTs. These
    // tests should be enough to start breaking up the proxy app code into more
    // easily testable parts and inject a fake openid client to side-step the
    // signaure requirement.
  });

  it("responds to the isolated api category endpoints described in the OIDC metadata response", async (done) => {
    // This test is making multiple requests. Theoretically it could be broken
    // up, with each request being made in a separate test. That would make it
    // much more difficult to use the metadata response to drive the requests
    // for the subsequent requests.
    const testServerIssolatedBaseUrlPattern = new RegExp(
      `^${defaultTestingConfig.host}${defaultTestingConfig.well_known_base_path}/veteran-verification-apis/v1.*`
    );

    const resp = await axios.get(
      "http://localhost:9090/testServer/veteran-verification-apis/v1/.well-known/openid-configuration"
    );
    const parsedMeta = resp.data;
    expect(parsedMeta).toMatchObject({
      authorization_endpoint: expect.any(String),
      token_endpoint: expect.any(String),
      userinfo_endpoint: expect.any(String),
      jwks_uri: expect.any(String),
    });

    expect(parsedMeta).toMatchObject({
      jwks_uri: expect.stringMatching(testServerIssolatedBaseUrlPattern),
      authorization_endpoint: expect.stringMatching(
        testServerIssolatedBaseUrlPattern
      ),
      userinfo_endpoint: expect.stringMatching(
        testServerIssolatedBaseUrlPattern
      ),
      token_endpoint: expect.stringMatching(testServerIssolatedBaseUrlPattern),
      introspection_endpoint: expect.stringMatching(
        testServerIssolatedBaseUrlPattern
      ),
    });

    await axios.get(parsedMeta.jwks_uri);
    await axios.get(parsedMeta.userinfo_endpoint);
    axios.post(parsedMeta.introspection_endpoint);

    const authorizeConfig = {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 500;
      },
      params: {
        client_id: "clientId123",
        state: "abc123",
        redirect_uri: "http://localhost:8080/oauth/redirect",
      },
    };
    const authorizeResp = await axios.get(
      parsedMeta.authorization_endpoint,
      authorizeConfig
    );
    expect(authorizeResp.status).toEqual(302);
    expect(authorizeResp.headers["location"]).toMatch(
      upstreamOAuthTestServerBaseUrlPattern
    );

    await axios.post(
      parsedMeta.token_endpoint,
      qs.stringify({ grant_type: "authorization_code", code: "xzy789" }),
      {
        auth: { username: "clientId123", password: "secretXyz" },
      }
    );
    done();
  });

  it("redirects the user back to the client app", async () => {
    const config = {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 500;
      },
      params: {
        state: "abc123",
        code: "xzy789",
      },
    };
    const resp = await axios.get(
      "http://localhost:9090/testServer/redirect",
      config
    );
    expect(resp.status).toEqual(302);
    expect(resp.headers.location).toMatch(
      new RegExp(`^${FAKE_CLIENT_APP_REDIRECT_URL}.*$`)
    );
  });

  it("returns an OIDC conformant token response", async () => {
    const resp = await axios.post(
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

    expect(resp.status).toEqual(200);
    const parsedResp = resp.data;
    const JWT_PATTERN = /[-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+/;
    expect(parsedResp).toMatchObject({
      access_token: expect.stringMatching(JWT_PATTERN),
      expires_in: expect.any(Number),
      id_token: expect.stringMatching(JWT_PATTERN),
      refresh_token: expect.stringMatching(/[-_a-zA-Z0-9]+/),
      scope: expect.stringMatching(/.+/),
      token_type: "Bearer",
    });
  });

  it("returns an OIDC conformant token response for the api category isolated endpoint", async () => {
    const resp = await axios.post(
      "http://localhost:9090/testServer/veteran-verification-apis/v1/token",
      qs.stringify({ grant_type: "authorization_code", code: "xzy789" }),
      {
        headers: {
          authorization: encodeBasicAuthHeader("user", "pass"),
          origin: "http://localhost:8080",
        },
        auth: { username: "clientId123", password: "secretXyz" },
      }
    );

    expect(resp.status).toEqual(200);
    const parsedResp = resp.data;
    const JWT_PATTERN = /[-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+/;
    expect(parsedResp).toMatchObject({
      access_token: expect.stringMatching(JWT_PATTERN),
      expires_in: expect.any(Number),
      id_token: expect.stringMatching(JWT_PATTERN),
      refresh_token: expect.stringMatching(/[-_a-zA-Z0-9]+/),
      scope: expect.stringMatching(/.+/),
      token_type: "Bearer",
    });
  });

  it("returns an OIDC conformant token response to client_credentials", async () => {
    const resp = await axios.post(
      "http://localhost:9090/testServer/token",
      qs.stringify({
        grant_type: "client_credentials",
        client_assertion: "tbd",
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        scopes: "launch/patient",
        launch: "123V456",
      }),
      {
        headers: {
          origin: "http://localhost:8080",
        },
        auth: { username: "clientId123", password: "secretXyz" },
      }
    );

    expect(resp.status).toEqual(200);
    const parsedResp = resp.data;
    const JWT_PATTERN = /[-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+/;
    expect(parsedResp).toMatchObject({
      access_token: expect.stringMatching(JWT_PATTERN),
      scope: expect.stringMatching(/.+/),
      patient: expect.stringMatching("123V456"),
      token_type: "Bearer",
    });
  });

  it("returns an OIDC conformant token response with status 400 from bad json", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/token",
        qs.stringify({
          grant_type: "authorization_code",
          client_assertion: "tbd",
          client_assertion_type:
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          scopes: "offline",
        }),
        {
          headers: {
            origin: "http://localhost:8080",
            "Content-type": "application/json",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then(() => {
        expect(true).toEqual(false);
      })
      .catch((err) => {
        expect(err.response.status).toEqual(400);
        expect(err.response.data.error).toEqual("invalid_request");
        expect(err.response.data.error_description).toEqual(
          "Invalid or unsupported content-type"
        );
      });
  });

  it("returns an OIDC conformant status 200 on token introspection", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/introspect",
        qs.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then((resp) => {
        expect(resp.status).toEqual(200);
        expect(resp.data.username).toEqual("john.doe@example.com");
      })
      .catch(() => {
        expect(true).toEqual(false);
      });
  });

  it("returns an OIDC conformant status 200 on token introspection for the api category isolated endpoint", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/veteran-verification-apis/v1/introspect",
        qs.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then((resp) => {
        expect(resp.status).toEqual(200);
        expect(resp.data.username).toEqual("john.doe@example.com");
      })
      .catch(() => {
        expect(true).toEqual(false);
      });
  });

  it("returns an OIDC conformant status 200 on token revocation", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/revoke",
        qs.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then((resp) => {
        expect(resp.status).toEqual(200);
      })
      .catch(() => {
        expect(true).toEqual(false);
      });
  });

  it("returns an OIDC conformant status 200 on token revocation for the api category isolated endpoint", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/veteran-verification-apis/v1/revoke",
        qs.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then((resp) => {
        expect(resp.status).toEqual(200);
      })
      .catch(() => {
        expect(true).toEqual(false);
      });
  });

  it("returns an OIDC conformant status 400 on token revocation, from missing authentication", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/revoke",
        qs.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            origin: "http://localhost:8080",
          },
        }
      )
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        // Handle Error Here
        expect(err.response.status).toEqual(400);
        expect(err.response.data).toEqual("invalid client_id");
      });
  });

  it("returns an OIDC conformant status 400 on token revocation, from missing authentication for the api category isolated endpoint", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/veteran-verification-apis/v1/revoke",
        qs.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            origin: "http://localhost:8080",
          },
        }
      )
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        // Handle Error Here
        expect(err.response.status).toEqual(400);
        expect(err.response.data).toEqual("invalid client_id");
      });
  });

  it("returns an OIDC conformant status 400 on token revocation, from missing token", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/revoke",
        qs.stringify({ token_type_hint: "access_token" }),
        {
          headers: {
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        // Handle Error Here
        expect(err.response.status).toEqual(400);
        expect(err.response.data).toEqual("invalid_request, missing `token`");
      });
  });

  it("returns an OIDC conformant status 400 on token revocation, from missing token for the api category isolated endpoint", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/veteran-verification-apis/v1/revoke",
        qs.stringify({ token_type_hint: "access_token" }),
        {
          headers: {
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        // Handle Error Here
        expect(err.response.status).toEqual(400);
        expect(err.response.data).toEqual("invalid_request, missing `token`");
      });
  });

  it("returns an OIDC conformant status 400 on sending json", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/revoke",
        JSON.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            "content-type": "application/json",
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        // Handle Error Here
        expect(err.response.status).toEqual(400);
      });
  });

  it("returns an OIDC conformant status 400 on sending json, isolated endpoint", async () => {
    await axios
      .post(
        "http://localhost:9090/testServer/veteran-verification-apis/v1/revoke",
        JSON.stringify({ token: "token", token_type_hint: "access_token" }),
        {
          headers: {
            "content-type": "application/json",
            authorization: encodeBasicAuthHeader("user", "pass"),
            origin: "http://localhost:8080",
          },
          auth: { username: "clientId123", password: "secretXyz" },
        }
      )
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        // Handle Error Here
        expect(err.response.status).toEqual(400);
      });
  });

  it("tests manage endpoint redirect", async () => {
    await axios
      .get("http://localhost:9090/testServer/manage")
      .then((resp) => {
        expect(resp.status).toEqual(200);
        expect(resp.data).toEqual("acls updated");
      })
      .catch(() => {
        expect(true).toEqual(false);
      });
  });

  it("tests manage endpoint redirect, isolated endpoint", async () => {
    await axios
      .get(
        "http://localhost:9090/testServer/veteran-verification-apis/v1/manage"
      )
      .then((resp) => {
        expect(resp.status).toEqual(200);
        expect(resp.data).toEqual("acls updated");
      })
      .catch(() => {
        expect(true).toEqual(false);
      });
  });

  it("returns a launch context given an access token from a client creds flow", async () => {
    await axios
      .get("http://localhost:9090/testServer/smart/launch", {
        headers: {
          authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5ceyJraWQiOiIzZkJCV0trc2JfY2ZmRGtYbVlSbmN1dGNtamFFMEFjeVdkdWFZc1NVa3o4IiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULmdtNVFDSl96dXVCbF9DZU1mSzRKNkNzMjR3MThxUG5zcXlQQzFBQWszZTAiLCJpc3MiOiJodHRwczovL2RlcHR2YS1ldmFsLm9rdGEuY29tL29hdXRoMi9hdXM4amExNXp6YjNwM21uWTJwNyIsImF1ZCI6Imh0dHBzOi8vc2FuZGJveC1hcGkudmEuZ292L3NlcnZpY2VzL2NjIiwiaWF0IjoxNjA1Mjg1NTI5LCJleHAiOjE2MDUyODU4MjksImNpZCI6IjBvYThvNzlsM2pXMFd6WjFMMnA3Iiwic2NwIjpbImxhdW5jaC9wYXRpZW50Il0sInN1YiI6IjBvYThvNzlsM2pXMFd6WjFMMnA3IiwiYWJjIjoiMTIzIiwidGVzdCI6IjEyMyJ9.L1y9yEzUt3uvRC5RSDHxlaOGqqdulFj9a1SpFKCGiDNvQ2JMuqhQ9uvNqAnWGUWf74D-pXJjjtz66uCQFHosYqNp1hd9T88EDJxMWsYOkUJR5XV180aMFVycJHw3ZyRgHfwrOihhxyB3Q3V6DhpL8EOOsAkLLJ_FvF40SYUjiqvNUslMYNJfzcJkwlcVBKoQKaszSnfYW0XnsOSHS4Ny7WA2m6hK2ReFcyWs78obQ0wM3GndjlkQPwq6wO9qDKcEZdN8YZ7wTzcID_NECEn6n4LxwD9NmfJrfie8312bq76Ca7tqLOXoqw49ClLXpGTfYSmHaNC9svMFVHedAAoMKweyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
        },
      })
      .then((resp) => {
        expect(resp.status).toEqual(200);
        expect(resp.data.launch).toEqual("123V456");
      })
      .catch((err) => {
        console.error(err);
        expect(true).toEqual(false); // Don't expect to be here
      });
  });

  it("launch context not found for an access token from a client creds flow", async () => {
    await axios
      .get("http://localhost:9090/testServer/smart/launch", {
        headers: {
          authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkphbmUgRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.cMErWtEf7DxCXJl8C9q0L7ttkm-Ex54UWHsOCMGbtUc",
        },
      })
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        expect(err.response.status).toEqual(401);
      });
  });

  it("missing authorization on a request for launch context given an access token from a client creds flow", async () => {
    await axios
      .get("http://localhost:9090/testServer/smart/launch")
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        expect(err.response.status).toEqual(401);
        expect(err.response.statusText).toEqual("Unauthorized");
      });
  });

  it("bad jwt on a request for launch context given an access token from a client creds flow", async () => {
    await axios
      .get("http://localhost:9090/testServer/smart/launch", {
        headers: {
          authorization: "Bearer xxx.xx.x.x.x-x.x.x",
        },
      })
      .then(() => {
        expect(true).toEqual(false); // Don't expect to be here
      })
      .catch((err) => {
        expect(err.response.status).toEqual(401);
        expect(err.response.statusText).toEqual("Unauthorized");
      });
  });
});
