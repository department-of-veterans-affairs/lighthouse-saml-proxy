const {
  dynamoclient,
} = require("../dynamo_client");

require("jest");

describe("dynamo client tests", () => {

  it("savePayloadToDynamo happy", async () => {

    let dynamoDb = createDynamoHandle(awsConfig, local);
    const payload = {
      body: {
        access_token: "utaccesstoken",
        launch: "uttestlaunch",
        expire_time: 36000
      },
    };

    const strategy = new PullDocumentByLaunchStrategy(req);

    const result = await dynamoclient.savePayloadToDynamo(
      dynamoDb,
      payload,
      "ClientCredentials");
    expect(result.status).toBe(200);
  });

 });
