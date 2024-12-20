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
  "fakekey",
  true
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

  it("should block login when mpi-user returns 503", async () => {
    const nextFn = jest.fn();
    const renderMock = jest.fn();
    const req: any = {
      mpiUserClient: { ...mpiUserClient },
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockRejectedValueOnce({
      name: "MPILookupFailure",
      statusCode: 503,
      message: "Service unavailable for MPI Lookup",
    });

    const response: any = { render: renderMock };
    await handlers.loadICN(req, response, nextFn);

    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(req.vsoClient.getVSOSearch).not.toHaveBeenCalled();
    expect(renderMock).toHaveBeenCalledWith("layout", {
      body: "internal_failure",
      request_id: undefined,
      wrapper_tags: accessiblePhoneNumber,
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should not block login when mpi-user returns 404", async () => {
    const nextFn = jest.fn();
    const renderMock = jest.fn();
    const req: any = {
      mpiUserClient: { ...mpiUserClient },
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockRejectedValueOnce({
      name: "MPILookupFailure",
      statusCode: 404,
      message: "Error with MPI Lookup",
    });

    const response: any = { render: renderMock };
    await handlers.loadICN(req, response, nextFn);

    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(req.vsoClient.getVSOSearch).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
  });

  it("should block login when fraudBlockEnabled is true and idTheftIndicator is true", async () => {
    const nextFn = jest.fn();
    const renderMock = jest.fn();
    const req: any = {
      mpiUserClient: { ...mpiUserClient, fraudBlockEnabled: true },
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
      idTheftIndicator: true,
    });

    const response: any = { render: renderMock };
    await handlers.loadICN(req, response, nextFn);

    expect(req.mpiUserClient.getMpiTraitsForLoa3User).toHaveBeenCalled();
    expect(renderMock).toHaveBeenCalledWith("layout", {
      body: "sensitive_error",
    });
    expect(nextFn).not.toHaveBeenCalled();
  });

  it("should not block login when fraudBlockEnabled is true and idTheftIndicator is false", async () => {
    const nextFn = jest.fn();
    const renderMock = jest.fn();
    const req: any = {
      mpiUserClient: { ...mpiUserClient, fraudBlockEnabled: true },
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
      idTheftIndicator: false,
    });

    const response: any = { render: renderMock };
    await handlers.loadICN(req, response, nextFn);

    expect(renderMock).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
  });

  it("should not block login when fraudBlockEnabled is false and idTheftIndicator is true", async () => {
    const nextFn = jest.fn();
    const renderMock = jest.fn();
    const req: any = {
      mpiUserClient: { ...mpiUserClient, fraudBlockEnabled: false },
      vsoClient: vsoClient,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.mpiUserClient.getMpiTraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
      idTheftIndicator: true,
    });

    const response: any = { render: renderMock };
    await handlers.loadICN(req, response, nextFn);

    expect(renderMock).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
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
      },
      authnRequest: {
        id: testSessionIndex,
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
      },
      authnRequest: {
        id: testSessionIndex,
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
  let mockSamlp: any;

  beforeAll(() => {
    req = defaultMockRequest;
    mockResponse = {
      render: jest.fn(),
    };
    mockNext = jest.fn();
    mockSamlp = jest.spyOn(samlp, "auth");
    mockSamlp.mockImplementation(jest.fn(() => jest.fn));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("authOptions includes inResponseTo if in SAMLResponse", () => {
    req.body.SAMLResponse =
      "PHNhbWxwOlJlc3BvbnNlIHhtbG5zOnNhbWxwPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiIElEPSJfYmZiZDA0M2I1ZGNhZDJjOWM4MmYiIEluUmVzcG9uc2VUbz0iaWQ4Mjg3MzQyOTYwMzg1NDQ2ODg0OTQ1NzIiIFZlcnNpb249IjIuMCIgSXNzdWVJbnN0YW50PSIyMDIzLTA2LTA3VDE2OjE0OjIzLjAyNVoiIERlc3RpbmF0aW9uPSJodHRwczovL2RlcHR2YS5va3RhcHJldmlldy5jb20vc3NvL3NhbWwyLzBvYTd5dzI1OHRXOTcwbDZTMWQ3Ij48c2FtbDpJc3N1ZXIgeG1sbnM6c2FtbD0idXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6Mi4wOmFzc2VydGlvbiI+aHR0cDovL2xvY2FsaG9zdDo3MDAwPC9zYW1sOklzc3Vlcj48U2lnbmF0dXJlIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwLzA5L3htbGRzaWcjIj48U2lnbmVkSW5mbz48Q2Fub25pY2FsaXphdGlvbk1ldGhvZCBBbGdvcml0aG09Imh0dHA6Ly93d3cudzMub3JnLzIwMDEvMTAveG1sLWV4Yy1jMTRuIyIvPjxTaWduYXR1cmVNZXRob2QgQWxnb3JpdGhtPSJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNyc2Etc2hhMjU2Ii8+PFJlZmVyZW5jZSBVUkk9IiNfYmZiZDA0M2I1ZGNhZDJjOWM4MmYiPjxUcmFuc2Zvcm1zPjxUcmFuc2Zvcm0gQWxnb3JpdGhtPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwLzA5L3htbGRzaWcjZW52ZWxvcGVkLXNpZ25hdHVyZSIvPjxUcmFuc2Zvcm0gQWxnb3JpdGhtPSJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzEwL3htbC1leGMtYzE0biMiLz48L1RyYW5zZm9ybXM+PERpZ2VzdE1ldGhvZCBBbGdvcml0aG09Imh0dHA6Ly93d3cudzMub3JnLzIwMDEvMDQveG1sZW5jI3NoYTI1NiIvPjxEaWdlc3RWYWx1ZT56T3gxRC9Cd1l1RXA4MVFIRnBEeWpCd2hESnNaV1dScjIxS1V6QlJDdCtvPTwvRGlnZXN0VmFsdWU+PC9SZWZlcmVuY2U+PC9TaWduZWRJbmZvPjwvU2lnbmF0dXJlPjxzYW1scDpTdGF0dXM+PHNhbWxwOlN0YXR1c0NvZGUgVmFsdWU9InVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDpzdGF0dXM6U3VjY2VzcyIvPjwvc2FtbHA6U3RhdHVzPjwvc2FtbHA6UmVzcG9uc2U+";
    handlers.serializeAssertions(req, mockResponse, mockNext);
    expect(mockSamlp.mock.calls[0][0].inResponseTo).toEqual(
      "id828734296038544688494572"
    );
  });

  it("authOptions excludes inResponseTo if not in SAMLResponse", () => {
    req.body.SAMLResponse =
      "lVRbb5swFP4riDxOYEPuFkFqwqZlazUtaRutL5MDJ4ENbORjQppfP0PWjkhd1735cr7L+XzkAHmRl2wFWEqBYB2LXCBrD2d2pQSTHDNkgheATMdsfXVzzXyXslJJLWOZ29Yymtnft7ttQgf97TCJeeLH03ji72zrHhRmUsxsgzCFiBUsBWoutDmift+hI4eOb70R8wbM77vUHz7YVgSoM8F1i0y1LpERkkCpD9yVPzUvFRwyqN1YFgRRksatT6jk48faH070Zjqm+WjtJWM7DJpL1iqrTnOv98YRQTXydtjIG/VcxjxPJWo2ppQGpMMaButsb9xW6nd6Z88GVNe1W/ddqfbENyhCp8QUJJjte/YZBclS7GQYLLiQIjMS2alt+wZ0KhPrKt9Llem0+AulRzzaUDpwjJ3YG4ieTTp23sxCB0/GnEIq6CnkDqbcH44avhXsQIGIwbpbLWd27+W3DoNbxQXupCqws/6n+kUsIA6QyxISB5+aaBy8ne3lREjXWpTtzXz9Zzam/d6fRM4U9zyvIDx9OXoRmdffqvflxPv68UMZPf6Y12n0CR82m5Xyvc93p/lqod/JWUC6yIA8J2vW3XEgz094nt+SrbXZ4uVuIROwWqrXpxnbarau4hgQ2zwuScnlHxD+Ag==";
    handlers.serializeAssertions(req, mockResponse, mockNext);
    expect(mockSamlp.mock.calls[0][0].inResponseTo).toBeUndefined();
  });
});
