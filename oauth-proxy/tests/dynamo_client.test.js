"use strict";

require("jest");

const dynamoclient = require("../dynamo_client");

describe("dynamo client tests", () => {
  it("savePayloadToDynamo happy", async () => {
    const mockDynamo = {};
    let isCalled = false;

    mockDynamo.dbDocClient = {
      put: (payloadDoc, result) => {
        isCalled = true;
        result(false, payloadDoc);
      },
    };

    try {
      await dynamoclient.savePayloadToDynamo(
        mockDynamo,
        { pay: "load" },
        "ClientCredentials"
      );
      expect(isCalled).toEqual(true);
    } catch (err) {
      // should not reach here
      expect(true).toEqual(false);
    }
  });

  it("savePayloadToDynamo error", async () => {
    const mockDynamo = {};
    mockDynamo.dbDocClient = {
      put: (payloadDoc, result) => {
        result({ message: "Missing key" }, undefined);
      },
    };

    try {
      await dynamoclient.savePayloadToDynamo(
        mockDynamo,
        { pay: "load" },
        "ClientCredentials"
      );
      // should not reach here
      expect(true).toEqual(false);
    } catch (err) {
      expect(err.message).toEqual("Missing key");
    }
  });

  it("saveToDynamoAccessToken happy", async () => {
    // const mockDynamo = {};
    let isCalled = false;

    const mockDynamo = {
      updateItem: (params, result) => {
        isCalled = true;
        result(false, params);
      },
    };

    try {
      await dynamoclient.saveToDynamoAccessToken(
        mockDynamo,
        "ut_access_token",
        "ut_key",
        "ut_value",
        "ut_table"
      );
      expect(isCalled).toEqual(true);
    } catch (err) {
      // should not reach here
      expect(true).toEqual(false);
    }
  });
});
