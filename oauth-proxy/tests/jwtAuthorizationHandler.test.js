"use strict";

require("jest");

const MockExpressResponse = require("mock-express-response");
const { jwtAuthorizationHandler } = require("../jwtAuthorizationHandler");

describe("jwtAuthorizationHandler", () => {
  it("missing jwt", () => {
    const req = {
      headers: {
        authorization: "NOT A JWT",
      },
    };

    const res = new MockExpressResponse();

    jwtAuthorizationHandler(req, res);
    expect(res.statusCode).toEqual(401);
  });

  it("bad jwt", () => {
    const req = {
      headers: {
        authorization: "Bearer ABC",
      },
    };

    const res = new MockExpressResponse();

    jwtAuthorizationHandler(req, res);
    expect(res.statusCode).toEqual(401);
  });

  it("good jwt", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const req = {
      headers: {
        authorization: "Bearer " + jwt,
      },
    };

    const res = new MockExpressResponse();
    res.locals = {};

    const next = () => {};

    jwtAuthorizationHandler(req, res, next);
    expect(res.locals.jwt).toEqual(jwt);
  });
});
