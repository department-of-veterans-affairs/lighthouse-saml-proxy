require("jest");

const dynamoclient = require("../dynamo_client");

describe("dynamo client tests", () => {

  it("savePayloadToDynamo happy", async () => {
    const AWS = jest.genMockFromModule("aws-sdk");
    // const mockAwsConfigUpdate = {
    //   saveToDynamoAccessToken: () => {
    //     testSaveToDynamoAccessTokenCalled = true;
    //     return new Promise((resolve) => {
    //       resolve(true);
    //     });
    //   },
    // };

    // const mockDynamo = {
    //   saveToDynamoAccessToken: () => {
    //     testSaveToDynamoAccessTokenCalled = true;
    //     return new Promise((resolve) => {
    //       resolve(true);
    //     });
    //   },
    // };

    let awsConfig = {};
    let local  = "local";

    let dynamoDb = dynamoclient.createDynamoHandle(awsConfig, local);
    const payload = {
      body: {
        access_token: "utaccesstoken",
        launch: "uttestlaunch",
        expire_time: 36000
      },
    };

    // let result = dynamoclient.savePayloadToDynamo(
    //   dynamoDb,
    //   payload,
    //   "ClientCredentials");
    // expect(result.status).toBe(200);
  });

 });
