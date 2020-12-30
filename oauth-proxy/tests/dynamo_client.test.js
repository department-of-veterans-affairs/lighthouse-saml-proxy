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

  it("getPayloadFromDynamo happy", async () => {
    const mockDynamo = {};
    let isCalled = false;

    let payloadDoc = {
      Item: {
        access_token: "ut_access_token",
        refresh_token: "ut_refresh_token",
      },
    };
    mockDynamo.dbDocClient = {
      get: (search_params, result) => {
        isCalled = true;
        if (search_params.Key.search == "me") {
          result(false, payloadDoc);
        } else {
          result(false, {});
        }
      },
    };

    try {
      let result = await dynamoclient.getPayloadFromDynamo(
        mockDynamo,
        { search: "me" },
        "TestTable"
      );
      expect(isCalled).toEqual(true);
      expect(result.Item.access_token).toEqual("ut_access_token");
      expect(result.Item.refresh_token).toEqual("ut_refresh_token");
    } catch (err) {
      // should not reach here
      expect(true).toEqual(false);
    }
  });

  it("getPayloadFromDynamo error", async () => {
    const mockDynamo = {};
    let isCalled = false;

    mockDynamo.dbDocClient = {
      get: (search_params, result) => {
        isCalled = true;
        result({ message: "non-existent table" }, false);
      },
    };

    try {
      await dynamoclient.getPayloadFromDynamo(
        mockDynamo,
        { search: "me" },
        "TestTable"
      );
      // should not reach here
      expect(false).toEqual(true);
    } catch (err) {
      expect(isCalled).toEqual(true);
      expect(err.message).toEqual("non-existent table");
    }
  });
});
