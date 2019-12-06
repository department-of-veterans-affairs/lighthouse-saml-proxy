const { config, DynamoDB } = require('aws-sdk');
const yargs = require('yargs');

const migrationConfig = yargs.usage("DynamoDB schema migration to set up the OAuth Proxy")
  .options({
    local: {
      boolean: true,
      default: false,
      description: 'Flag to use localhost instead of Docker container hostname',
      required: false,
    }
  })
  .wrap(yargs.terminalWidth())
  .argv;

// The credenials set here must match those found in docker-compose.yml, oauth-proxy
config.update({
  accessKeyId: 'NONE',
  region: 'us-west-2',
  secretAccessKey: 'NONE',
});

const endpoint = migrationConfig.local ? 'http://localhost:8000' : 'http://dynamodb:8000';
console.log(`Running migration to create DynamoDB schema for OAuth proxy against the DynamoDB instance at ${endpoint}...`);
const dynamo = new DynamoDB({ endpoint });

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
