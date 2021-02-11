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
    try {
      manageHandler(res, "");
      fail("handler should throw 404s on empty URLs.")
    }catch(err) {
      expect(err.response.status).toEqual(404)
      expect(err.response.error).toBe("NOT FOUND")
      expect(err.response.error_description).toBe("No manage url defined for this endpoint.")
    }
  })

  it("Null URL", () => {
    try {
      manageHandler(res, null);
      fail("handler should throw 404s on empty URLs.")
    }catch(err) {
      expect(err.response.status).toEqual(404)
      expect(err.response.error).toBe("NOT FOUND")
      expect(err.response.error_description).toBe("No manage url defined for this endpoint.")
    }
  })

  it("Undefined URL", () => {
    try {
      manageHandler(res, undefined);
      fail("handler should throw 404s on empty URLs.")
    }catch(err) {
      expect(err.response.status).toEqual(404)
      expect(err.response.error).toBe("NOT FOUND")
      expect(err.response.error_description).toBe("No manage url defined for this endpoint.")
    }
  })
})