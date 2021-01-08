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

  it("scanFromDynamo happy", async () => {
    const mockDynamo = {};
    let isCalled = false;

    let payloadDoc = {
      Items: [
        {
          static_icn: "0123456789",
          static_refresh_token: "ut_refresh_token",
          static_access_token: "ut_access_token",
          static_scopes:
            "openid profile patient/Medication.read launch/patient offline_access",
          static_expires_in: 3600,
        },
      ],
      Count: 1,
      ScannedCount: 1,
      ConsumedCapacity: null,
    };

    mockDynamo.dbDocClient = {
      scan: (scan_params, result) => {
        isCalled = true;
        if (scan_params.TableName == "TestTable") {
          result(false, payloadDoc);
        } else {
          result(false, {});
        }
      },
    };

    try {
      let result = await dynamoclient.scanFromDynamo(mockDynamo, "TestTable");
      expect(isCalled).toEqual(true);
      expect(result.Items[0].static_access_token).toEqual("ut_access_token");
      expect(result.Items[0].static_refresh_token).toEqual("ut_refresh_token");
    } catch (err) {
      // should not reach here
      expect(true).toEqual(false);
    }
  });

  it("scanFromDynamo error", async () => {
    const mockDynamo = {};
    let isCalled = false;

    mockDynamo.dbDocClient = {
      scan: (scan_params, result) => {
        isCalled = true;
        result({ message: "non-existent table" }, false);
      },
    };

    try {
      await dynamoclient.scanFromDynamo(mockDynamo, "TestTable");
      // should not reach here
      expect(false).toEqual(true);
    } catch (err) {
      expect(isCalled).toEqual(true);
      expect(err.message).toEqual("non-existent table");
    }
  });
});
