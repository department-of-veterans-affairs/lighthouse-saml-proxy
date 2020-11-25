"use strict";

require("jest");

const dynamoclient = require("../dynamo_client");

describe("dynamo client tests", () => {
  it("savePayloadToDynamo happy", async () => {
    const mockDynamo = {};
    let testPutIsCalled = false;

    mockDynamo.dbDocClient = {
      put: (payloadDoc, result) => {
        testPutIsCalled = true;
        result(false, payloadDoc);
      },
    };

    try {
      await dynamoclient.savePayloadToDynamo(
        mockDynamo,
        { pay: "load" },
        "ClientCredentials"
      );
      expect(testPutIsCalled).toEqual(true);
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
});
