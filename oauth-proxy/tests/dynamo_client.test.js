"use strict";

require("jest");

jest.mock("aws-sdk");

const { DynamoClient } = require("../dynamo_client");

describe("dynamo client tests", () => {
  const dynamoclient = new DynamoClient(
    Object.assign({}, { region: "config.aws_region" }, null, null),
    "http://localhost:8000"
  );

  it("savePayloadToDynamo happy", async () => {
    let isCalled = false;

    dynamoclient.dbDocClient.put.mockImplementation((payloadDoc, result) => {
      isCalled = true;
      result(null, payloadDoc);
    });

    try {
      await dynamoclient.savePayloadToDynamo(
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
    dynamoclient.dbDocClient.put.mockImplementation((payloadDoc, result) => {
      result({ message: "Missing key" }, null);
    });

    try {
      await dynamoclient.savePayloadToDynamo(
        { pay: "load" },
        "ClientCredentials"
      );
      // should not reach here
      expect(true).toEqual(false);
    } catch (err) {
      expect(err.message).toEqual("Missing key");
    }
  });

  it("updateToDynamo happy", async () => {
    let isCalled = false;

    dynamoclient.dbDocClient.update.mockImplementation((params, result) => {
      isCalled = true;
      result(false, params);
    });

    try {
      await dynamoclient.updateToDynamo(
        { key: "ut_access_token" },
        { ut_key: "ut_value" },
        "ut_table"
      );
      expect(isCalled).toEqual(true);
    } catch (err) {
      // should not reach here
      expect(true).toEqual(false);
    }
  });

  it("scanFromDynamo happy", async () => {
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

    dynamoclient.dbDocClient.scan.mockImplementation((scan_params, result) => {
      isCalled = true;
      if (scan_params.TableName == "TestTable") {
        result(false, payloadDoc);
      } else {
        result(false, {});
      }
    });

    try {
      let result = await dynamoclient.scanFromDynamo("TestTable");
      expect(isCalled).toEqual(true);
      expect(result.Items[0].static_access_token).toEqual("ut_access_token");
      expect(result.Items[0].static_refresh_token).toEqual("ut_refresh_token");
    } catch (err) {
      // should not reach here
      expect(true).toEqual(false);
    }
  });

  it("scanFromDynamo error", async () => {
    let isCalled = false;

    dynamoclient.dbDocClient.scan.mockImplementation((scan_params, result) => {
      isCalled = true;
      result({ message: "non-existent table" }, false);
    });

    try {
      await dynamoclient.scanFromDynamo("TestTable");
      // should not reach here
      expect(false).toEqual(true);
    } catch (err) {
      expect(isCalled).toEqual(true);
      expect(err.message).toEqual("non-existent table");
    }
  });

  it("getPayloadFromDynamo happy", async () => {
    let isCalled = false;

    let payloadDoc = {
      Item: {
        access_token: "ut_access_token",
        refresh_token: "ut_refresh_token",
      },
    };

    dynamoclient.dbDocClient.get.mockImplementation((search_params, result) => {
      isCalled = true;
      if (search_params.Key.search == "me") {
        result(false, payloadDoc);
      } else {
        result(false, {});
      }
    });

    try {
      let result = await dynamoclient.getPayloadFromDynamo(
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
    let isCalled = false;
    dynamoclient.dbDocClient.get.mockImplementation((search_params, result) => {
      isCalled = true;
      result({ message: "non-existent table" }, false);
    });

    try {
      await dynamoclient.getPayloadFromDynamo({ search: "me" }, "TestTable");
      // should not reach here
      expect(false).toEqual(true);
    } catch (err) {
      expect(isCalled).toEqual(true);
      expect(err.message).toEqual("non-existent table");
    }
  });
});
