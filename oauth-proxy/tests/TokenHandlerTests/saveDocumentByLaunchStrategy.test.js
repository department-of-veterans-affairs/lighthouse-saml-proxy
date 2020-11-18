const {
  SaveDocumentLaunchStrategy,
} = require("../../oauthHandlers/tokenHandlerStrategyClasses/saveDocumentStrategies/saveDocumentLaunchStrategy");

require("jest");

describe("saveDocumentByLaunchStrategy tests", () => {
  it("empty launch", async () => {
    let testSaveToDynamoAccessTokenCalled = false;

    const mockDynamoClient = {
      saveToDynamoAccessToken: () => {
        testSaveToDynamoAccessTokenCalled = true;
        return new Promise((resolve) => {
          resolve(true);
        });
      },
    };

    const document = {};

    const strategy = new SaveDocumentLaunchStrategy(
      null,
      null,
      mockDynamoClient,
      null,
      null
    );
    await strategy.saveDocumentToDynamo(document, null);

    expect(testSaveToDynamoAccessTokenCalled).toBe(false);
  });

  it("happy path", async () => {
    const saveToDynamoAccessTokenCalledWith = {};

    const mockDynamo = {};
    const mockHashingFunction = () => {
      return "hash";
    };
    const mockLogger = { error: () => {} };
    const mockDynamoClient = {
      saveToDynamoAccessToken: (client, accessToken, key, value, TableName) => {
        saveToDynamoAccessTokenCalledWith.client = client;
        saveToDynamoAccessTokenCalledWith.accessToken = accessToken;
        saveToDynamoAccessTokenCalledWith.key = key;
        saveToDynamoAccessTokenCalledWith.value = value;
        saveToDynamoAccessTokenCalledWith.TableName = TableName;
        return new Promise((resolve) => {
          resolve(true);
        });
      },
    };

    const config = {
      dynamo_client_credentials_table: "dynamo_client_credentials_table",
      hmac_secret: "hmac_secret",
    };
    const document = { launch: { S: "42" } };
    const tokens = { access_token: "access_token" };

    const strategy = new SaveDocumentLaunchStrategy(
      mockLogger,
      mockDynamo,
      mockDynamoClient,
      config,
      mockHashingFunction
    );
    await strategy.saveDocumentToDynamo(document, tokens);

    // Expect saveToDynamoAccessToken to have been called with the correct values
    expect(saveToDynamoAccessTokenCalledWith.client).toBe(mockDynamo);
    expect(saveToDynamoAccessTokenCalledWith.accessToken).toBe(
      mockHashingFunction()
    );
    expect(saveToDynamoAccessTokenCalledWith.key).toBe("launch");
    expect(saveToDynamoAccessTokenCalledWith.value).toBe(document.launch.S);
    expect(saveToDynamoAccessTokenCalledWith.TableName).toBe(
      config.dynamo_client_credentials_table
    );
  });

  it("exception thrown", async () => {
    const loggerCalledWith = {};
    const expectedError = { error: "expected error" };

    const mockLogger = {
      error: (message, error) => {
        loggerCalledWith.message = message;
        loggerCalledWith.error = error;
      },
    };
    const mockHashingFunction = () => {
      return "hash";
    };
    const mockDynamoClient = {
      saveToDynamoAccessToken: () => {
        throw expectedError;
      },
    };

    const config = {
      hmac_secret: "hmac_secret",
    };
    const document = { launch: { S: "42" } };
    const tokens = { access_token: "access_token" };

    const strategy = new SaveDocumentLaunchStrategy(
      mockLogger,
      null,
      mockDynamoClient,
      config,
      mockHashingFunction
    );
    await strategy.saveDocumentToDynamo(document, tokens);

    // Expect an exception to have occurred and been logged
    expect(loggerCalledWith.message).toBe(
      "Could not update the access token token in DynamoDB"
    );
    expect(loggerCalledWith.error).toBe(expectedError);
  });
});
