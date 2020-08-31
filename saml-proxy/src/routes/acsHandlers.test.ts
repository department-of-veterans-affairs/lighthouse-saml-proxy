import "jest";
import { Response, Request, NextFunction } from "express";

import * as handlers from "./acsHandlers";
import { VetsAPIClient } from "../VetsAPIClient";
import { MVIRequestMetrics } from "../metrics";
jest.mock("../VetsAPIClient");

const client = new VetsAPIClient("fakeToken", "https://example.gov");

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

describe("scrubUserClaims", () => {
  it("should return a user claims object with only permitted keys for dslogon logins", () => {
    // ICN will have been looked up before this function runs
    const req = { user: { claims: { icn: "anICN", ...claimsWithEDIPI } } };
    const nextFn = jest.fn();
    handlers.scrubUserClaims(req, {}, nextFn);
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
    const req = { user: { claims: { icn: "anICN", ...claimsWithNoEDIPI } } };
    const nextFn = jest.fn();
    handlers.scrubUserClaims(req, {}, nextFn);
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
    const req = {
      user: {
        claims: { firstName: "Ed", lastName: "Paget", ...claimsWithICN },
      },
    };
    const nextFn = jest.fn();
    handlers.scrubUserClaims(req, {}, nextFn);
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
});

describe("loadICN", () => {
  beforeEach(() => {
    client.getMVITraitsForLoa3User.mockReset();
  });

  it("should call getMVITraits... calls when ICN Exists", async () => {
    const nextFn = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: { ...claimsWithICN },
      },
    };

    req.vetsAPIClient.getMVITraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
    });
    await handlers.loadICN(req, {}, nextFn);
    expect(req.vetsAPIClient.getMVITraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
  });

  it("should load ICN and assign it as a user claim when edipi exists and no icn", async () => {
    const nextFn = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: { ...claimsWithEDIPI },
      },
    };

    req.vetsAPIClient.getMVITraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
    });
    await handlers.loadICN(req, {}, nextFn);
    expect(req.vetsAPIClient.getMVITraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
  });

  it("should load ICN and assign it as a user claim when traits exist and no icn", async () => {
    const nextFn = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: { ...claimsWithNoEDIPI },
      },
    };
    req.vetsAPIClient.getMVITraitsForLoa3User.mockResolvedValueOnce({
      icn: "anICN",
      first_name: "Edward",
      last_name: "Paget",
    });
    await handlers.loadICN(req, {}, nextFn);
    expect(req.vetsAPIClient.getMVITraitsForLoa3User).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual("anICN");
  });

  it("should render error page when getMVITraitsForLoa3User errors and getVSOSearch errors", async () => {
    const nextFn = jest.fn();
    const render = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: { ...claimsWithNoEDIPI },
      },
    };
    const err = new Error("Oops");
    err.name = "StatusCodeError";
    err.statusCode = "404";
    req.vetsAPIClient.getMVITraitsForLoa3User.mockRejectedValueOnce(err);
    req.vetsAPIClient.getVSOSearch.mockRejectedValueOnce(err);
    await handlers.loadICN(req, { render }, nextFn);
    expect(render).toHaveBeenCalled();
  });
});

describe("requestWithMetrics", () => {
  it("should call the passed in functions promise", async () => {
    let called = false;
    const func = () => {
      return new Promise((resolve, _) => {
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
