const { RequestError } = require("request-promise-native/errors");
const jwt = require("njwt");
const fs = require("fs");

const ISSUER_METADATA = {
  authorization_endpoint: "http://example.com/authorization",
  token_endpoint: "http://example.com/token",
  userinfo_endpoint: "http://example.com/userinfo",
  introspection_endpoint: "http://example.com/introspect",
  revocation_endpoint: "http://example.com/revoke",
  jwks_uri: "http://example.com/keys",
  issuer: "http://example.com/issuer",
};

function buildDynamoAttributeValue(value) {
  // BEWARE: This doesn't work with number sets and a few other Dynamo types.
  if (value.constructor === String) {
    return { S: value };
  } else if (value.constructor === Number) {
    return { N: value.toString() };
  } else if (value.constructor === Boolean) {
    return { BOOL: value };
  } else if (value.constructor === Array) {
    return {
      L: value.map((x) => {
        buildDynamoAttributeValue(x);
      }),
    };
  } else if (value.constructor === Object) {
    return { M: convertObjectToDynamoAttributeValues(value) };
  } else {
    throw new Error("Unknown type.");
  }
}

function convertObjectToDynamoAttributeValues(obj) {
  return Object.entries(obj).reduce((accum, pair) => {
    accum[pair[0]] = buildDynamoAttributeValue(pair[1]);
    return accum;
  }, {});
}

/**
 * Mock dynamoClient implementation.
 *
 * Implemented methods:
 * - savePayloadToDynamo
 * - updateToDynamo
 * - queryFromDynamo
 * - getPayloadFromDynamo
 * - scanFromDynamo
 *
 * @param mockRecord The mock record.
 */
function mockDynamoClient(mockRecord) {
  return buildFakeDynamoClient(mockRecord);
}
function buildFakeDynamoClient(fakeDynamoRecord) {
  const dynamoClient = {};

  dynamoClient.savePayloadToDynamo = jest.fn().mockImplementation((payload) => {
    return new Promise((resolve) => {
      // It's unclear whether this should resolve with a full records or just
      // the identity field but thus far it has been irrelevant to the
      // functional testing of the oauth-proxy.
      resolve({ pk: payload.internal_state });
    });
  });
  dynamoClient.updateToDynamo = jest
    .fn()
    .mockImplementation((rowkey, payload) => {
      return new Promise((resolve) => {
        // It's unclear whether this should resolve with a full records or just
        // the identity field but thus far it has been irrelevant to the
        // functional testing of the oauth-proxy.
        resolve({ Item: payload });
      });
    });
  dynamoClient.queryFromDynamo = jest
    .fn()
    .mockImplementation((queryParam, tableName) => {
      return new Promise((resolve, reject) => {
        if (
          fakeDynamoRecord &&
          fakeDynamoRecord[Object.keys(queryParam)[0]] &&
          fakeDynamoRecord[Object.keys(queryParam)[0]] ===
            Object.values(queryParam)[0]
        ) {
          const out = { Items: [fakeDynamoRecord] };
          resolve(out);
        } else {
          reject(`no such ${queryParam} value on ${tableName}`);
        }
      });
    });
  dynamoClient.getPayloadFromDynamo = jest
    .fn()
    .mockImplementation((searchAttributes, tableName) => {
      return new Promise((resolve, reject) => {
        const searchkey = Object.keys(searchAttributes)[0];
        const searchVal = Object.values(searchAttributes)[0];
        if (fakeDynamoRecord[searchkey] === searchVal) {
          resolve({ Item: fakeDynamoRecord });
        } else {
          reject(`no such state value on ${tableName}`);
        }
      });
    });
  dynamoClient.scanFromDynamo = jest.fn().mockImplementation((tableName) => {
    return new Promise((resolve, reject) => {
      if (tableName === fakeDynamoRecord.static_token_table) {
        resolve(convertObjectToDynamoAttributeValues(fakeDynamoRecord));
      } else {
        reject(`no such state value on ${tableName}`);
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
      authorization_endpoint: "fake_endpoint",
      token_endpoint: "fake_endpoint",
    };
    this.discover = jest.fn();
  }
}

function buildFakeOktaClient(
  fakeRecord,
  getAuthorizationServerInfoMock,
  userCollection,
  grant
) {
  const oClient = {
    getApplication: jest.fn(),
    listUsers: jest.fn(),
    grant: jest.fn(),
  };
  oClient.getApplication.mockImplementation((client_id) => {
    return new Promise((resolve, reject) => {
      if (client_id === fakeRecord.client_id) {
        resolve(fakeRecord);
      } else {
        reject(`no such client application '${client_id}'`);
      }
    });
  });
  oClient.getAuthorizationServer = getAuthorizationServerInfoMock;
  oClient.listUsers = () => {
    return userCollection;
  };
  oClient.grant.mockImplementation(() => {
    if (grant) {
      return grant;
    } else {
      throw { error: "error", error_description: "error_description" };
    }
  });
  return oClient;
}

const buildFakeGetAuthorizationServerInfoResponse = (audiences) => {
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

const buildOpenIDClient = (fns) => {
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

const buildExpiredRefreshTokenClient = () => {
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

/**
 * Mock logger implementation.
 *
 * Implemented methods:
 * - error
 * - info
 * - warn
 */
const mockLogger = () => {
  return buildFakeLogger();
};
const buildFakeLogger = () => {
  return { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
};

/**
 * Default / sample application config.
 */
const defaultConfig = () => {
  return createFakeConfig();
};
const createFakeConfig = () => {
  return {
    host: "http://localhost:7100",
    well_known_base_path: "/oauth2",
    upstream_issuer: "https://deptva-eval.okta.com/oauth2/default",
    upstream_issuer_timeout_ms: 15000,
    dynamo_local: "dynamodb:8000",
    dynamo_table_name: "OAuthRequests",
    dynamo_oauth_requests_table: "OAuthRequestsV2",
    dynamo_launch_context_table: "LaunchContext",
    hmac_secret: "secret",
    okta_url: "https://deptva-eval.okta.com",
    validate_post_endpoint:
      "https://sandbox-api.va.gov/internal/auth/v1/validation",
    validate_apiKey: "validate_apiKey",
    okta_token: "okta_token",
    enable_pkce_authorization_flow: true,
    enable_okta_consent_endpoint: true,
    enable_smart_launch_service: true,
    enable_static_token_service: true,
    dynamo_static_token_table: "ut_static_tokens_table",
    dynamo_clients_table: "Clients",
    routes: {
      categories: [
        {
          api_category: "/health/v1",
          upstream_issuer:
            "https://deptva-eval.okta.com/oauth2/aus7y0ho1w0bSNLDV2p7",
          manage_endpoint: "https://staging.va.gov/account",
          audience: "https://sandbox-api.va.gov/services/fhir",
        },
        {
          api_category: "/benefits/v1",
          upstream_issuer:
            "https://deptva-eval.okta.com/oauth2/aus7y0lyttrObgW622p7",
          manage_endpoint: "https://staging.va.gov/account",
          audience: "https://sandbox-api.va.gov/services/fhir",
        },
        {
          api_category: "/veteran-verification/v1",
          upstream_issuer:
            "https://deptva-eval.okta.com/oauth2/aus7y0sefudDrg2HI2p7",
          manage_endpoint: "https://staging.va.gov/account",
          audience: "https://sandbox-api.va.gov/services/fhir",
        },
        {
          api_category: "/noManage",
          upstream_issuer:
            "https://deptva-eval.okta.com/oauth2/aus7y0sefudDrg2HI2p7",
          audience: "https://sandbox-api.va.gov/services/fhir",
        },
        {
          api_category: "/overrideEndpoints",
          upstream_issuer:
            "https://deptva-eval.okta.com/oauth2/aus7y0ho1w0bSNLDV2p7",
          manage_endpoint: "https://staging.va.gov/account",
          custom_metadata: {
            authorization_endpoint: "http://example.com/authorization",
            token_endpoint: "http://example.com/token",
            userinfo_endpoint: "http://example.com/userinfo",
            introspection_endpoint: "http://example.com/introspect",
            revocation_endpoint: "http://example.com/revoke",
            jwks_uri: "http://example.com/keys",
            issuer: "http://example.com/issuer",
          },
          audience: "https://sandbox-api.va.gov/services/fhir",
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
        grants: "/grants",
        smart_launch: "/smart/launch",
      },
    },
  };
};

const jwtEncodeClaims = (claims, expires_on) => {
  const privateKey = fs.readFileSync("./tests/ut_key", "utf8");
  const encodedClaims = jwt.create(claims, privateKey, "RS256");
  encodedClaims.setExpiration(expires_on);
  return encodedClaims.compact();
};

const createFakeHashingFunction = () => {
  let hash = jest.fn();

  hash.mockImplementation((value) => {
    return value;
  });

  return hash;
};

module.exports = {
  convertObjectToDynamoAttributeValues,
  buildFakeOktaClient,
  mockDynamoClient,
  buildFakeDynamoClient,
  buildFakeGetAuthorizationServerInfoResponse,
  buildOpenIDClient,
  buildExpiredRefreshTokenClient,
  FakeIssuer,
  mockLogger,
  buildFakeLogger,
  defaultConfig,
  createFakeConfig,
  jwtEncodeClaims,
  createFakeHashingFunction,
  ISSUER_METADATA,
};
