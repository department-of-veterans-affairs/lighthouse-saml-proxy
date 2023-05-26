import "jest";

import * as handlers from "./acsHandlers";
import { MpiUserClient } from "../MpiUserClient";
import { VsoClient } from "../VsoClient";
import { MVIRequestMetrics } from "../metrics";
import { TestCache } from "./types";
import {
  buildSamlResponseFunction,
  defaultMockRequest,
} from "../../test/testUtils";
import { idpConfig } from "../../test/testServer";
import { IDME_USER } from "../../test/testUsers";
import { accessiblePhoneNumber } from "../utils";
import samlp from "samlp";

jest.mock("passport");
jest.mock("../VsoClient");
jest.mock("../MpiUserClient");
jest.mock("../logger");

import passport from "passport";
import logger from "../logger";

const vsoClient = new VsoClient("fakeToken", "https://example.gov");
const mpiUserClient = new MpiUserClient(
  "fakeToken",
  "http://example.com/mpiuser",
  "fakekey"
);

// Technically Doesn't TypeCheck, but typechecking is off for test files
// Since there's no way to make it work in tests with the mix of js and ts

const claimsWithICN = {
  icn: "asdfasdf",
  email: "ed@example.gov",
  uuid: "totally-uniq",
  level_of_assurance: "0",
  mhv_account_type: "Premium",
};

const claimsWithEDIPI = {
  idp: "id_me",
  dateOfBirth: "1990-01-01",
  edipi: "asdfasdfasdf",
  firstName: "Edward",
  gender: "male",
  lastName: "Paget",
  middleName: "John",
  email: "ed@example.gov",
  uuid: "totally-uniq",
  level_of_assurance: "0",
  dslogon_assurance: "2",
};

const claimsWithNoEDIPI = {
  dateOfBirth: "1990-01-01",
  firstName: "Edward",
  gender: "male",
  lastName: "Paget",
  middleName: "John",
  ssn: "333-99-8988",
  email: "ed@example.gov",
  uuid: "totally-uniq",
  level_of_assurance: "3",
};

const claimsLoginGov = {
  dateOfBirth: "1990-01-01",
  firstName: "Edward",
  gender: "male",
  lastName: "Paget",
  middleName: "John",
  ssn: "333-99-8988",
  email: "ed@example.gov",
  uuid: "totally-uniq",
  ial: 3,
  aal: 2,
};

const claimsBasicAccount = {
  icn: "asdfasdf",
  email: "ed@example.gov",
  uuid: "totally-uniq",
  level_of_assurance: "0",
};
describe("scrubUserClaims", () => {
  it("should return a user claims object with only permitted keys for dslogon logins", () => {
    // ICN will have been looked up before this function runs
    const req: any = { user: { claims: { icn: "anICN", ...claimsWithEDIPI } } };
    const nextFn = jest.fn();
    const response: any = {};
    handlers.scrubUserClaims(req, response, nextFn);
    expect(req.user.claims).toEqual(
      expect.objectContaining({
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        middleName: expect.any(String),
        level_of_assurance: expect.any(String),
        icn: expect.any(String),
        dslogon_assurance: "2",
        mhv_account_type: undefined,
        uuid: expect.any(String),
      })
    );
    expect(req.user.claims).toEqual(
      expect.not.objectContaining({
        edipi: expect.any(String),
        ssn: expect.any(String),
        gender: expect.any(String),
        dateOfBirth: expect.any(String),
      })
    );
  });

  it("should return a user claims object with only permitted keys for idme logins", () => {
    // ICN will have been looked up before this function runs
    const req: any = {
      user: { claims: { icn: "anICN", ...claimsWithNoEDIPI } },
    };
    const nextFn = jest.fn();
    const response: any = {};
    handlers.scrubUserClaims(req, response, nextFn);
    expect(req.user.claims).toEqual(
      expect.objectContaining({
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        middleName: expect.any(String),
        level_of_assurance: expect.any(String),
        icn: expect.any(String),
        dslogon_assurance: undefined,
        mhv_account_type: undefined,
        uuid: expect.any(String),
      })
    );
    expect(req.user.claims).toEqual(
      expect.not.objectContaining({
        ssn: expect.any(String),
        gender: expect.any(String),
        dateOfBirth: expect.any(String),
      })
    );
  });

  it("should return a user claims object with only permitted keys for mhv logins", () => {
    // First and Last Name are looked up in MVI before this function runs
    const req: any = {
      user: {
        claims: { firstName: "Ed", lastName: "Paget", ...claimsWithICN },
      },
    };
    const nextFn = jest.fn();
    const response: any = {};
    handlers.scrubUserClaims(req, response, nextFn);
    expect(req.user.claims).toEqual(
      expect.objectContaining({
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        middleName: undefined,
        level_of_assurance: expect.any(String),
        icn: expect.any(String),
        dslogon_assurance: undefined,
        mhv_account_type: expect.any(String),
        uuid: expect.any(String),
      })
    );
    expect(req.user.claims).toEqual(
      expect.not.objectContaining({
        ssn: expect.any(String),
        gender: expect.any(String),
        dateOfBirth: expect.any(String),
      })
    );
  });

  it("should return a user claims object with only permitted keys for login.gov logins", () => {
    // First and Last Name are looked up in MVI before this function runs
    const req: any = {
      user: {
        claims: { ...claimsLoginGov },
      },
    };
    const nextFn = jest.fn();
    const response: any = {};
    handlers.scrubUserClaims(req, response, nextFn);
    expect(req.user.claims).toEqual(
      expect.objectContaining({
        firstName: expect.any(String),
        lastName: expect.any(String),
        email: expect.any(String),
        middleName: expect.any(String),
        level_of_assurance: undefined,
        icn: undefined,
        dslogon_assurance: undefined,
        mhv_account_type: undefined,
        uuid: expect.any(String),
        ial: expect.any(Number),
        aal: expect.any(Number),
      })
    );
    expect(req.user.claims).toEqual(
      expect.not.objectContaining({
        ssn: expect.any(String),
        gender: expect.any(String),
        dateOfBirth: expect.any(String),
      })
    );
  });
});

describe("loadICN", () => {
  beforeEach(() => {
    // @ts-ignore
    mpiUserClient.getMpiTraitsForLoa3User.mockReset();
    // @ts-ignore
    vsoClient.getVSOSearch.mockReset();
  });

  it("should call getMVITraits... calls when ICN Exists", async () => {
    const nextFn = jest.fn();
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
    });
    const response: any = {};
    await handlers.loadICN(req, response, nextFn);
    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
  });

  it("should call getMVITraits... calls when ICN Exists, null first_name", async () => {
    const nextFn = jest.fn();
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: null,
      last_name: "Paget",
    });
    const response: any = {};
    await handlers.loadICN(req, response, nextFn);
    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
    expect(logger.warn).toHaveBeenCalledWith("Null mpi_user first_name");
  });

  it("should call getMVITraits... calls when ICN Exists, null last_name", async () => {
    const nextFn = jest.fn();
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: null,
    });
    const response: any = {};
    await handlers.loadICN(req, response, nextFn);
    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
    expect(logger.warn).toHaveBeenCalledWith("Null mpi_user last_name");
  });

  it("should load ICN and assign it as a user claim when edipi exists and no icn", async () => {
    const nextFn = jest.fn();
    const req: any = {
      mpiUserClient: mpiUserClient,
      user: {
        claims: { ...claimsWithEDIPI },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
    });
    const response: any = {};
    await handlers.loadICN(req, response, nextFn);
    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
  });

  it("should load ICN and assign it as a user claim when traits exist and no icn", async () => {
    const nextFn = jest.fn();
    const req: any = {
      mpiUserClient: mpiUserClient,
      user: {
        claims: { ...claimsWithNoEDIPI },
      },
    };
    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
    });
    const response: any = {};
    await handlers.loadICN(req, response, nextFn);
    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
  });

  it("should render error page when getMVITraitsForLoa3User errors and getVSOSearch errors", async () => {
    const nextFn = jest.fn();
    const render = jest.fn();
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithNoEDIPI },
      },
    };
    const err = new Error("Oops");
    err.name = "StatusCodeError";
    // @ts-ignore
    err.statusCode = "404";
    req.mpiUserClient.getMpiTraitsForLoa3User.mockRejectedValueOnce(err);
    req.vsoClient.getVSOSearch.mockRejectedValueOnce(err);
    const response: any = { render };
    await handlers.loadICN(req, response, nextFn);
    expect(render).toHaveBeenCalled();
  });
});

describe("requestWithMetrics", () => {
  it("should call the passed in functions promise", async () => {
    let called = false;
    const func = () => {
      return new Promise<void>((resolve) => {
        called = true;
        resolve();
      });
    };

    await handlers.requestWithMetrics(MVIRequestMetrics, func);
    expect(called).toBeTruthy();
  });

  it("should bubble rejections up as an exception", async () => {
    const func = () => {
      return new Promise((_, reject) => {
        reject(new Error("error"));
      });
    };

    // For expect sytax explination checkout https://github.com/facebook/jest/issues/1700
    await expect(
      handlers.requestWithMetrics(MVIRequestMetrics, func)
    ).rejects.toThrowError();
  });
});

describe("validateIdpResponse", () => {
  let mockResponse: any;

  beforeEach(() => {
    mockResponse = {
      render: jest.fn(),
    };
  });
  it("should cache session index for a given saml response", async () => {
    const nextFn = jest.fn();
    const testSessionIndex = "test";
    const cache = new TestCache();
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithEDIPI },
        authnContext: {
          sessionIndex: testSessionIndex,
        },
      },
    };

    const validateFn = handlers.validateIdpResponse(cache, true);
    await validateFn(req, mockResponse, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(cache.has(testSessionIndex));
  });

  it("should return sensitiveError on repeated idp saml response", async () => {
    const nextFn = jest.fn();
    const testSessionIndex = "test";
    const cache = new TestCache();
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithEDIPI },
        authnContext: {
          sessionIndex: testSessionIndex,
        },
      },
    };

    const validateFn = handlers.validateIdpResponse(cache, true);
    await validateFn(req, mockResponse, nextFn).catch((err) => {
      fail("Test failure due to unexpected error " + err);
    });
    await validateFn(req, mockResponse, nextFn).catch((err) => {
      fail("Test failure due to unexpected error " + err);
    });

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(mockResponse.render).toHaveBeenCalledTimes(1);
    expect(mockResponse.render.mock.calls[0][0]).toBe("layout");
    expect(mockResponse.render.mock.calls[0][1]["body"]).toBe(
      "sensitive_error"
    );
  });

  it("should throw an error when processing a saml response with no session index", async () => {
    const nextFn = jest.fn();
    const cache = new TestCache();
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithEDIPI },
        authnContext: {},
      },
    };

    const validateFn = handlers.validateIdpResponse(cache, true);
    await validateFn(req, mockResponse, nextFn).catch((err) => {
      fail("Test failure due to unexpected error " + err);
    });

    expect(nextFn).toHaveBeenCalledTimes(0);
    expect(mockResponse.render).toHaveBeenCalledTimes(1);
    expect(mockResponse.render.mock.calls[0][0]).toBe("layout");
    expect(mockResponse.render.mock.calls[0][1]["body"]).toBe(
      "sensitive_error"
    );
  });

  it("should not cache anything when cache is not enabled", async () => {
    const nextFn = jest.fn();
    const testSessionIndex = "test";
    const cache = new TestCache();
    const req: any = {
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithEDIPI },
        authnContext: {
          sessionIndex: testSessionIndex,
        },
      },
    };

    const validateFn = handlers.validateIdpResponse(cache, false);
    await validateFn(req, mockResponse, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(!(await cache.has(testSessionIndex)));
  });
});

describe("testLevelOfAssuranceOrRedirect", () => {
  let mockResponse: any;
  beforeEach(() => {
    mockResponse = {
      render: jest.fn(),
    };
  });

  it("testLevelOfAssuranceOrRedirect, sufficient loa.", async () => {
    const nextFn = jest.fn();
    const testSessionIndex = "test";
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithEDIPI },
        authnContext: {
          sessionIndex: testSessionIndex,
        },
      },
    };
    handlers.testLevelOfAssuranceOrRedirect(req, mockResponse, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  it("testLevelOfAssuranceOrRedirect, sufficient loa. loginGov", async () => {
    const nextFn = jest.fn();
    const testSessionIndex = "test";
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: {
          idp: "logingov",
          ial: 2,
          aal: 2,
        },
        authnContext: {
          sessionIndex: testSessionIndex,
        },
      },
    };
    handlers.testLevelOfAssuranceOrRedirect(req, mockResponse, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  it("testLevelOfAssuranceOrRedirect, insufficient loa", async () => {
    const nextFn = jest.fn();
    let redirectUrl;
    mockResponse.redirect = jest.fn((url) => {
      redirectUrl = url;
    });
    const testSessionIndex = "test";
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsBasicAccount },
        authnContext: {
          sessionIndex: testSessionIndex,
        },
      },
      body: {
        RelayState: "relateState",
      },
    };
    handlers.testLevelOfAssuranceOrRedirect(req, mockResponse, nextFn);
    expect(nextFn).not.toHaveBeenCalled();
    expect(redirectUrl).toBe(
      "/samlproxy/sp/verify?authnContext=http%3A%2F%2Fidmanagement.gov%2Fns%2Fassurance%2Floa%2F3&RelayState=relateState"
    );
  });

  it("testLevelOfAssuranceOrRedirect, insufficient loa and missing relay state", async () => {
    const nextFn = jest.fn();
    mockResponse.redirect = jest.fn((url) => {
      fail("Redirect should not have been called to '" + url + "'");
    });
    const testSessionIndex = "test";
    const req: any = {
      mpiUserClient: mpiUserClient,
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsBasicAccount },
        authnContext: {
          sessionIndex: testSessionIndex,
        },
      },
    };
    let errStatus;
    let errMessage;
    try {
      handlers.testLevelOfAssuranceOrRedirect(req, mockResponse, nextFn);
    } catch (err) {
      errStatus = err.status;
      errMessage = err.message;
    }
    expect(nextFn).not.toHaveBeenCalled();
    expect(errStatus).toBe(400);
    expect(errMessage).toBe(
      "Error: Empty relay state during loa test. Invalid request."
    );
  });
});

describe("buildPassportLoginHandler", () => {
  let req: any;
  let mockResponse: any;
  let mockNext: any;
  const buildSamlResponse = buildSamlResponseFunction(1);
  beforeEach(async () => {
    req = defaultMockRequest;
    mockResponse = {
      render: jest.fn(),
    };
    mockNext = jest.fn();
    // @ts-ignore
    passport.authenticate.mockImplementation((args) => {
      expect(args).toBe("wsfed-saml2");
      return jest.fn;
    });
  });

  it("happy path", () => {
    req.query.SAMLResponse = buildSamlResponse(IDME_USER, "3", idpConfig);
    handlers.buildPassportLoginHandler("http://example.com/acs")(
      req,
      mockResponse,
      mockNext
    );
    expect(passport.authenticate).toHaveBeenCalledTimes(1);
  });

  it("Invalid request method", () => {
    req.method = null;
    handlers.buildPassportLoginHandler("http://example.com/acs")(
      req,
      mockResponse,
      mockNext
    );
    expect(mockResponse.render).toHaveBeenCalledWith("layout", {
      body: "error",
      request_id: undefined,
      message: "Invalid assertion response.",
      wrapper_tags: accessiblePhoneNumber,
    });
  });

  it("no SAMLResponse", () => {
    handlers.buildPassportLoginHandler("http://example.com/acs")(
      req,
      mockResponse,
      mockNext
    );
    expect(mockResponse.render).toHaveBeenCalledWith("layout", {
      body: "error",
      request_id: undefined,
      message: "Invalid assertion response.",
      wrapper_tags: accessiblePhoneNumber,
    });
  });
});

describe("serializeAssertions", () => {
  let req: any;
  let mockResponse: any;
  let mockNext: any;
  beforeEach(async () => {
    req = defaultMockRequest;
    req.session = {
      authnRequest: {
        relayState: undefined,
        id: "id182335062341510412002199304",
        issuer:
          "https://www.okta.com/saml2/service-provider/spayqztpxyfjkeunxobw",
        destination: "http://localhost:7000/sso",
        acsUrl: "https://deptva-eval.okta.com/sso/saml2/0oa37x2cwf9yOtqGb2p7",
        forceAuthn: false,
      },
    };
    req.options = {
      ssoResponse: {
        state: "something",
      },
    };
    req.idp = {
      options: {},
    };
    req.user = {
      authnContext: {
        authnMethod: "test",
      },
    };
    mockResponse = {
      render: jest.fn(),
    };
    mockNext = jest.fn();
  });

  it("buildAuthOptions includes inResponseTo", () => {
    const mockSamlp = jest.spyOn(samlp, "auth");
    mockSamlp.mockImplementation(jest.fn(() => jest.fn));
    handlers.serializeAssertions(req, mockResponse, mockNext);
    expect(mockSamlp.mock.calls[0][0].inResponseTo).toEqual("id182335062341510412002199304");
  });
});
