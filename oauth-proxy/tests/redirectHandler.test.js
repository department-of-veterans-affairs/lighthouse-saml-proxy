"use strict";

require("jest");
const MockExpressRequest = require("mock-express-request");
const MockExpressResponse = require("mock-express-response");
const Collection = require("@okta/okta-sdk-nodejs/src/collection");
const ModelFactory = require("@okta/okta-sdk-nodejs/src/model-factory");
const User = require("@okta/okta-sdk-nodejs/src/models/User");
const { redirectHandler } = require("../oauthHandlers");
const { buildFakeDynamoClient } = require("./testUtils");

const userCollection = new Collection("", "", new ModelFactory(User));
userCollection.currentItems = [{ id: 1 }];

let logger;
let dynamoClient;
let next;
let req;
let res;
let config;

beforeEach(() => {
  logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
  dynamoClient = jest.mock();
  next = jest.fn();
  req = new MockExpressRequest();
  res = new MockExpressResponse();
  config = { dynamo_table_name: "tableName" };
  dynamoClient = buildFakeDynamoClient({
    state: "abc123",
    code: "the_fake_authorization_code",
    refresh_token: "",
    redirect_uri: "http://localhost/thisDoesNotMatter",
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

    await redirectHandler(logger, dynamoClient, config, req, res, next);
    expect(res.redirect).toHaveBeenCalled();
  });

  it("No state, returns 400", async () => {
    await redirectHandler(logger, dynamoClient, config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("State is empty, returns 400", async () => {
    req.query = { state: null };
    await redirectHandler(logger, dynamoClient, config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Query using state fails, returns 400", async () => {
    dynamoClient.getPayloadFromDynamo = (searchAttributes, tableName) => {
      return new Promise((resolve, reject) => {
        reject(`no such state value on ${tableName}`);
      });
    };
    req.query = { state: "xxxxx" };
    await redirectHandler(logger, dynamoClient, config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });

  it("Query using state fails with bad return from dynamo, returns 400", async () => {
    dynamoClient.getPayloadFromDynamo = () => {
      return new Promise((resolve) => {
        resolve(null);
      });
    };
    req.query = { state: "xxxxx" };
    await redirectHandler(logger, dynamoClient, config, req, res, next);
    expect(res.statusCode).toEqual(400);
  });
});
