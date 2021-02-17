"use strict";

require("jest");
const MockExpressRequest = require("mock-express-request");
const MockExpressResponse = require("mock-express-response");
const Collection = require("@okta/okta-sdk-nodejs/src/collection");
const ModelFactory = require("@okta/okta-sdk-nodejs/src/model-factory");
const User = require("@okta/okta-sdk-nodejs/src/models/User");
const { revokeUserGrantHandler } = require("../oauthHandlers");
const { buildFakeOktaClient } = require("./testUtils");
const revokeGrantsForUserAndClientMock = jest.fn();
const getApplicationMock = jest.fn();
const getUserIdsMock = jest.fn();
const getAuthorizationServerInfoMock = jest.fn();

const userCollection = new Collection(
  {
    http: {
      http: async () => {
        return new Promise((resolve) => {
          resolve({
            headers: {
              get: () => {
                return null;
              },
            },
            json: () => {
              return [];
            },
          });
        });
      },
    },
  },
  "",
  new ModelFactory(User)
);
userCollection.currentItems = [{ id: 1 }];

let oktaClient;
let res;
let req;
let next;

beforeEach(() => {
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

  jest.clearAllMocks();
  next = jest.fn();
  req = new MockExpressRequest();
  res = new MockExpressResponse();
  revokeGrantsForUserAndClientMock.mockReset();
  getApplicationMock.mockReset();
  getUserIdsMock.mockReset();
  oktaClient.revokeGrantsForUserAndClient = revokeGrantsForUserAndClientMock;
  oktaClient.getApplication = getApplicationMock;
});

describe("revokeUserGrantHandler", () => {
  it("Happy Path", async () => {
    revokeGrantsForUserAndClientMock.mockResolvedValue({ status: 200 });
    getApplicationMock.mockResolvedValue({ client_id: "clientid123" });
    req.body = { client_id: "clientid123", email: "email@example.com" };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(200);
  });

  it("Client Id Empty", async () => {
    req.body = { client_id: "", user_id: "userid123" };
    await revokeUserGrantHandler(undefined, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Email Empty", async () => {
    req.body = { client_id: "clientid123", email: "" };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Client Id Null", async () => {
    req.body = { user_id: "userid123" };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Email Null", async () => {
    req.body = { client_id: "clientid123" };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Invalid Client Id", async () => {
    revokeGrantsForUserAndClientMock.mockResolvedValue({ status: 200 });
    getApplicationMock.mockResolvedValue({ client_id: "clientid123" });
    req.body = { client_id: "clientid123!", email: "email@example.com" };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("No User Ids associated with Email", async () => {
    revokeGrantsForUserAndClientMock.mockResolvedValue({ status: 200 });
    getApplicationMock.mockResolvedValue({ client_id: "clientid123" });
    userCollection.currentItems = [];
    req.body = { client_id: "clientid123", email: "email@example.com" };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Invalid Email", async () => {
    revokeGrantsForUserAndClientMock.mockResolvedValue({ status: 200 });
    getApplicationMock.mockResolvedValue({ client_id: "clientid123" });
    req.body = { client_id: "clientid123", email: "email@example" };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Email with additional filtering", async () => {
    revokeGrantsForUserAndClientMock.mockResolvedValue({ status: 200 });
    getApplicationMock.mockResolvedValue({ client_id: "clientid123" });
    req.body = {
      client_id: "clientid123",
      email: 'email@example.com or firstName eq "John"',
    };
    await revokeUserGrantHandler(oktaClient, req, res, next);
    expect(res.statusCode).toEqual(400);
  });
});
