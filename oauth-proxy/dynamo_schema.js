const { config, DynamoDB } = require('aws-sdk');

// The credenials set here must match those found in docker-compose.yml, oauth-proxy
config.update({
  accessKeyId: 'NONE',
  region: 'us-west-2',
  secretAccessKey: 'NONE',
});

const dynamo = new DynamoDB({
  endpoint: 'http://dynamodb:8000',
});

const tableParams = {
  AttributeDefinitions: [
    { AttributeName: 'state', AttributeType: 'S' },
    { AttributeName: 'code', AttributeType: 'S' },
    { AttributeName: 'refresh_token', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'state', KeyType: 'HASH' },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 10,
    WriteCapacityUnits: 10
  },
  GlobalSecondaryIndexes: [
    {
      IndexName: 'oauth_code_index',
      KeySchema: [
        {
          AttributeName: 'code',
          KeyType: 'HASH',
        },
      ],
      Projection: {
        ProjectionType: 'ALL',
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
      },
    },
    {
      IndexName: 'oauth_refresh_token_index',
      KeySchema: [
        {
          AttributeName: 'refresh_token',
          KeyType: 'HASH',
        },
      ],
      Projection: {
        ProjectionType: 'ALL',
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
      },
    },
  ],
  TableName: 'OAuthRequests',
};

dynamo.createTable(tableParams, (err, data) => {
  if (err) {
    console.error('Unable to create table. Error JSON:', JSON.stringify(err, null, 2));
  } else {
    console.log('Created table. Table description JSON:', JSON.stringify(data, null, 2));
  }
});
