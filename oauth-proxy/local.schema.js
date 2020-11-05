const { config, DynamoDB } = require("aws-sdk");

const endpoint = "http://localhost:8000";
// The credenials set here must match those found in docker-compose.yml, oauth-proxy
config.update({
  region: "us-west-2",
  endpoint: endpoint,
});

console.log(
  `Running migration to create DynamoDB schema for OAuth proxy against the DynamoDB instance at ${endpoint}...`
);
const dynamo = new DynamoDB({ endpoint });

const tableParams = {
  AttributeDefinitions: [
    { AttributeName: "user_name", AttributeType: "S" },
    { AttributeName: "password", AttributeType: "S" },
  ],
  KeySchema: [{ AttributeName: "user_name", KeyType: "HASH" }],
  ProvisionedThroughput: {
    ReadCapacityUnits: 10,
    WriteCapacityUnits: 10,
  },
  GlobalSecondaryIndexes: [
    {
      IndexName: "password_index",
      KeySchema: [
        {
          AttributeName: "password",
          KeyType: "HASH",
        },
      ],
      Projection: {
        ProjectionType: "ALL",
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
    },
  ],
  TableName: "OAuthRequests",
};

dynamo.createTable(tableParams, (err, data) => {
  if (err) {
    console.error(
      "Unable to create table. Error JSON:",
      JSON.stringify(err, null, 2)
    );
  } else {
    console.log(
      "Created table. Table description JSON:",
      JSON.stringify(data, null, 2)
    );
  }
});
