const { RequestError } = require("request-promise-native/errors");

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
      authorization_endpoint: "fake_endpoint",
      token_endpoint: "fake_endpoint",
    };
  }
}

function buildFakeOktaClient(
  fakeRecord,
  getAuthorizationServerInfoMock,
  userCollection
) {
  const oClient = { getApplication: jest.fn(), listUsers: jest.fn() };
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

module.exports = {
  buildDynamoAttributeValue,
  convertObjectToDynamoAttributeValues,
  buildFakeOktaClient,
  buildFakeDynamoClient,
  buildFakeGetAuthorizationServerInfoResponse,
  buildOpenIDClient,
  buildExpiredRefreshTokenClient,
  FakeIssuer,
};
