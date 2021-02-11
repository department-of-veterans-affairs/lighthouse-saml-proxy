"use strict";

require("jest");
const MockExpressResponse = require("mock-express-response");
const { manageHandler } = require("../oauthHandlers");
describe("Manage Endpoint Tests", () => {
  let res;

  beforeEach(() => {
    res = new MockExpressResponse();
  });

  it("Valid URL", () => {
    manageHandler(res, "url");
    expect(res.statusCode).toEqual(302);
  })

  it("Empty String URL", () => {
    manageHandler(res, "");
    expect(res.statusCode).toEqual(404);
  })

  it("Null URL", () => {
    manageHandler(res, null);
    expect(res.statusCode).toEqual(404);
  })

  it("Undefined URL", () => {
    manageHandler(res, undefined);
    expect(res.statusCode).toEqual(404);
  })
})