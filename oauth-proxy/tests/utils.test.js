"use strict";

require("jest");
const {
  statusCodeFromError,
  parseBasicAuth,
  parseClientId,
  parseBearerAuthorization,
  hashString,
  minimalError,
} = require("../utils");

describe("statusCodeFromError", () => {
  describe("returns the default", () => {
    it("if response is undefined", () => {
      expect(statusCodeFromError({})).toEqual(500);
    });

    it("if response.statusCode is undefined", () => {
      expect(statusCodeFromError({ response: {} })).toEqual(500);
    });
  });

  it("returns the value in response.statusCode if defined", () => {
    expect(statusCodeFromError({ response: { statusCode: 404 } })).toEqual(404);
  });
});

describe("parseBasicAuth", () => {
  describe("undefined", () => {
    it("missing request returns undefined", () => {
      expect(parseBasicAuth()).toEqual(undefined);
    });

    it("invalid request type returns undefined", () => {
      expect(parseBasicAuth("request")).toEqual(undefined);
    });

    it("empty request returns undefined", () => {
      expect(parseBasicAuth({})).toEqual(undefined);
    });

    it("invalid headers type returns undefined", () => {
      expect(parseBasicAuth({ headers: "headers" })).toEqual(undefined);
    });

    it("empty headers returns undefined", () => {
      expect(parseBasicAuth({ headers: {} })).toEqual(undefined);
    });

    it("invalid authorization type returns undefined", () => {
      expect(parseBasicAuth({ headers: { authorization: {} } })).toEqual(
        undefined
      );
    });

    it("invalid authorization returns undefined", () => {
      expect(parseBasicAuth({ headers: { authorization: "Basic " } })).toEqual(
        undefined
      );
    });

    it("invalid username password returns undefined", () => {
      let usernamePassword = Buffer.from("user1").toString("base64");
      expect(
        parseBasicAuth({
          headers: { authorization: `Basic ${usernamePassword}` },
        })
      ).toEqual(undefined);
    });
  });

  it("valid username password returns undefined", () => {
    let usernamePassword = Buffer.from("user1:pass1").toString("base64");
    let credentials = parseBasicAuth({
      headers: { authorization: `Basic ${usernamePassword}` },
    });
    expect(credentials.username).toEqual("user1");
    expect(credentials.password).toEqual("pass1");
  });

  it("hashString", () => {
    let unhashedString = "this_is_the_string_to_be_hashed";
    let expectedHashString =
      "b8006bab9baf73277873c694f0d37b7a04e372cb0575720fd5a3fa1dcb4d62aa";
    let actualHashString = hashString(unhashedString, "secret");
    expect(expectedHashString).toEqual(actualHashString);
  });
});

describe("parseClientId", () => {
  const validClientId = "1";
  const specialCharacters = [
    " ",
    "`",
    "~",
    "!",
    "@",
    "#",
    "$",
    "$",
    "%",
    "^",
    "&",
    "*",
    "(",
    ")",
    "-",
    "_",
    "=",
    "+",
    "[",
    "{",
    "]",
    "}",
    "\\",
    "|",
    ";",
    ":",
    "'",
    '"',
    ",",
    "<",
    ".",
    ">",
    "/",
    "?",
  ];
  it("Valid Client Id", () => {
    let result = parseClientId(validClientId);
    expect(result).toEqual(true);
  });

  it("Query Client Id", () => {
    let clientId = "?q=name";
    let result = parseClientId(clientId);
    expect(result).toEqual(false);
  });

  it("Filter Client Id", () => {
    let clientId = '?filter=client_name eq "name"';
    let result = parseClientId(clientId);
    expect(result).toEqual(false);
  });

  it("Special Characters", () => {
    specialCharacters.forEach((specialCharacter) => {
      let clientId = validClientId + specialCharacter;
      let result = parseClientId(clientId);
      expect(result).toEqual(false);
    });
  });
});

describe("parseBearerAuthorization", () => {
  it("undefined", () => {
    expect(parseBearerAuthorization()).toBe(null);
  });
  it("Unmatched regex 1", () => {
    expect(parseBearerAuthorization("ABC")).toBe(null);
  });
  it("Unmatched regex 2", () => {
    expect(parseBearerAuthorization("Bearer")).toBe(null);
  });
  it("Unmatched regex 3", () => {
    expect(parseBearerAuthorization("Bearer a b")).toBe(null);
  });
  it("Match", () => {
    expect(parseBearerAuthorization("Bearer jwt")).toBe("jwt");
  });
});

describe("minimalError", () => {
  it("API-3493 verbose log on timeout fix verification", () => {
    let testError = {
      service: "oauth-proxy",
      name: "TimeoutError",
      code: "ETIMEDOUT",
      hostname: "deptva-eval.okta.com",
      method: "POST",
      path: "/oauth2/xxx/v1/token",
      protocol: "https:",
      url: "https://xxx/oauth2/xxxxxx/v1/token",
      event: "request",
      level: "error",
      message:
        "Failed to retrieve tokens using the OpenID client Timeout awaiting 'request' for 10000ms",
      stack:
        "TimeoutError: Timeout awaiting 'request' for 10000ms\n    at ClientRequest.<anonymous> (/home/node/node_modules/got/source/request-as-event-emitter.js:176:14)\n    at Object.onceWrapper (events.js:421:26)\n    at ClientRequest.emit (events.js:326:22)\n    at ClientRequest.EventEmitter.emit (domain.js:483:12)\n    at ClientRequest.origin.emit (/home/node/node_modules/@szmarczak/http-timer/source/index.js:37:11)\n    at Immediate.timeoutHandler (/home/node/node_modules/got/source/utils/timed-out.js:63:11)\n    at processImmediate (internal/timers.js:463:21)",
      time: "2020-12-08T18:54:51.085Z",
    };
    let result = minimalError(testError);
    expect(result.message).toBe(
      "Failed to retrieve tokens using the OpenID client Timeout awaiting 'request' for 10000ms"
    );
    expect(result.name).toBe("TimeoutError");
    expect(Object.keys(result)).toHaveLength(2);
  });
  it("pass through error as a string", () => {
    expect(minimalError("Some error")).toBe("Some error");
  });

  it("verify whitelist of other fields", () => {
    let testErr = {
      statusCode: 500,
      error: "ut_token_failure",
      error_description: "Failed to retrieve access_token.",
      status: "Internal server error",
    };
    let result = minimalError(testErr);
    expect(result.statusCode).toBe(500);
    expect(result.status).toBe("Internal server error");
    expect(result.error).toBe("ut_token_failure");
    expect(result.error_description).toBe("Failed to retrieve access_token.");
  });
});
