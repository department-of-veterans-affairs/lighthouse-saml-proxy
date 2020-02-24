'use strict';

require('jest');
const request = require('request-promise-native');
const { Issuer } = require('openid-client');
const { randomBytes } = require('crypto');

const { convertObjectToDynamoAttributeValues } = require('./testUtils');
const { buildBackgroundServerModule } = require('../../common/backgroundServer');
const upstreamOAuthTestServer = require('./upstreamOAuthTestServer');
const { startServerInBackground, stopBackgroundServer } = buildBackgroundServerModule("oauth-proxy test app");
const { buildApp } = require('../index');
const { encodeBasicAuthHeader } = require('../utils');

beforeAll(() => {
  upstreamOAuthTestServer.start();
});

afterAll(() => {
  upstreamOAuthTestServer.stop();
});

const TEST_SERVER_PORT = 9090;
const FAKE_CLIENT_APP_REDIRECT_URL = 'http://localhost:8080/oauth/redirect';
const FAKE_CLIENT_APP_URL_PATTERN = /http:[/][/]localhost:8080.*/;
const defaultTestingConfig = {
  host: `http://localhost:${TEST_SERVER_PORT}`,
  well_known_base_path: '/testServer',
  upstream_issuer: upstreamOAuthTestServer.baseUrl(),
  validate_endpoint: "http://localhost",
  validate_apiKey: "fakeApiKey",
};

function buildFakeOktaClient(fakeRecord) {
  const oktaClient = { getApplication: jest.fn() };
  oktaClient.getApplication.mockImplementation(client_id => {
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


function buildFakeDynamoClient(fakeDynamoRecord) {
  const dynamoClient = jest.genMockFromModule('../dynamo_client.js');
  dynamoClient.saveToDynamo.mockImplementation((handle, state, key, value) => {
    return new Promise((resolve, reject) => {
      // It's unclear whether this should resolve with a full records or just
      // the identity field but thus far it has been irrelevant to the
      // functional testing of the oauth-proxy.
      resolve({ pk: state });
    });
  });
  dynamoClient.getFromDynamoBySecondary.mockImplementation((handle, attr, value) => {
    return new Promise((resolve, reject) => {
      if (fakeDynamoRecord[attr] === value) {
        resolve(convertObjectToDynamoAttributeValues(fakeDynamoRecord));
      } else {
        reject(`no such ${attr} value`);
      }
    });
  });
  dynamoClient.getFromDynamoByState.mockImplementation((handle, state) => {
    return new Promise((resolve, reject) => {
      if (state === fakeDynamoRecord.state) {
        resolve(convertObjectToDynamoAttributeValues(fakeDynamoRecord));
      } else {
        reject('no such state value');
      }
    });
  });
  return dynamoClient;
}

describe('OpenID Connect Conformance', () => {
  let issuer;
  let oktaClient;
  let dynamoClient;
  let dynamoHandle;
  const testServerBaseUrlPattern = new RegExp(`^${defaultTestingConfig.host}${defaultTestingConfig.well_known_base_path}.*`);
  const upstreamOAuthTestServerBaseUrlPattern = new RegExp(`^${upstreamOAuthTestServer.baseUrl()}.*`);

  beforeAll(async () => {
    issuer = await Issuer.discover(upstreamOAuthTestServer.baseUrl());
    oktaClient = buildFakeOktaClient({
      client_id: 'clientId123',
      client_secret: 'secretXyz',
      settings: {
        oauthClient: {
          redirect_uris: ['http://localhost:8080/oauth/redirect'],
        },
      }
    });
    dynamoClient = buildFakeDynamoClient({
      state: 'abc123',
      code: 'xyz789',
      refresh_token: 'jkl456',
      redirect_uri: FAKE_CLIENT_APP_REDIRECT_URL,
    });
    dynamoHandle = jest.mock();

    const fakeTokenValidator = (access_token) => {
      return {
        va_identifiers: {
          icn: '0000000000000'
        }
      };
    };

    const app = buildApp(defaultTestingConfig, issuer, oktaClient, dynamoHandle, dynamoClient, fakeTokenValidator);
    // We're starting and stopping this server in a beforeAll/afterAll pair,
    // rather than beforeEach/afterEach because this is an end-to-end
    // functional. Since internal application state could affect functionality
    // in production, we want to expose these tests to that same risk.
    startServerInBackground(app, TEST_SERVER_PORT);
  });

  afterAll(() => {
    stopBackgroundServer();
  });

  it('allows CORS on the OIDC metadata endpoint', async () => {
    const randomHeaderName = randomBytes(20).toString('hex');
    const resp = await request({
      simple: false,
      resolveWithFullResponse: true,
      method: 'options',
      uri: 'http://localhost:9090/testServer/.well-known/openid-configuration',
      headers: {
        'origin': 'http://localhost:8080',
        'access-control-request-headers': randomHeaderName,
      }
    });
    expect(resp.statusCode).toEqual(200);
    expect(resp.headers['access-control-allow-headers']).toMatch(randomHeaderName);
    expect(resp.headers['access-control-allow-origin']).toMatch(FAKE_CLIENT_APP_URL_PATTERN);
  });

  it('responds to the endpoints described in the OIDC metadata response', async () => {
    // This test is making multiple requests. Theoretically it could be broken
    // up, with each request being made in a separate test. That would make it
    // much more difficult to use the metadata response to drive the requests
    // for the subsequent requests.
    const resp = await request({
      method: 'get',
      uri: 'http://localhost:9090/testServer/.well-known/openid-configuration',
    });
    const parsedMeta = JSON.parse(resp);
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

    await request({ method: 'get', uri: parsedMeta.jwks_uri });
    await request({
      method: 'get',
      uri: parsedMeta.userinfo_endpoint,
    });
    await request({
      method: 'post',
      uri: parsedMeta.introspection_endpoint,
    });
    const authorizeResp = await request({
      followRedirect: false,
      simple: false,
      resolveWithFullResponse: true,
      method: 'get',
      uri: parsedMeta.authorization_endpoint,
      qs: {
        client_id: 'clientId123',
        state: 'abc123',
        redirect_uri: 'http://localhost:8080/oauth/redirect',
      },
    });
    expect(authorizeResp.statusCode).toEqual(302);
    expect(authorizeResp.headers['location']).toMatch(upstreamOAuthTestServerBaseUrlPattern);
    await request({
      method: 'post',
      headers: { Authorization: 'Basic clientId123:secretXyz' },
      uri: parsedMeta.token_endpoint,
      resolveWithFullResponse: true,
      form: { grant_type: 'authorization_code', code: 'xzy789' },
    });
    // TODO: We should really call the token endpoint using the refresh_token
    // grant type here. Right now the openid-client library makes this a little
    // difficult. It automatically verifies the signature of the new access
    // token. That's great, but doing full e2e testing would require making the
    // upstream test server support constructing and signing proper JWTs. These
    // tests should be enough to start breaking up the proxy app code into more
    // easily testable parts and inject a fake openid client to side-step the
    // signaure requirement.
  });

  it('redirects the user back to the client app', async () => {
    const resp = await request({
      followRedirect: false,
      simple: false,
      resolveWithFullResponse: true,
      method: 'get',
      uri: 'http://localhost:9090/testServer/redirect',
      qs: {
        state: 'abc123',
        code: 'xzy789',
      }
    });
    expect(resp.statusCode).toEqual(302);
    expect(resp.headers.location).toMatch(new RegExp(`^${FAKE_CLIENT_APP_REDIRECT_URL}.*$`));
  });

  it('returns an OIDC conformant token response', async () => {
    const resp = await request({
      simple: false,
      resolveWithFullResponse: true,
      method: 'post',
      uri: 'http://localhost:9090/testServer/token',
      headers: {
        'authorization': encodeBasicAuthHeader('user', 'pass'),
        'origin': 'http://localhost:8080',
      },
      form: {
        grant_type: 'authorization_code',
        code: 'xyz789',
      }
    });

    expect(resp.statusCode).toEqual(200);
    const parsedResp = JSON.parse(resp.body);
    const JWT_PATTERN = /[-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+[.][-_a-zA-Z0-9]+/;
    expect(parsedResp).toMatchObject({
      access_token: expect.stringMatching(JWT_PATTERN),
      expires_in: expect.any(Number),
      id_token: expect.stringMatching(JWT_PATTERN),
      refresh_token: expect.stringMatching(/[-_a-zA-Z0-9]+/),
      scope: expect.stringMatching(/.+/),
      token_type: 'Bearer',
    });
  });
});
