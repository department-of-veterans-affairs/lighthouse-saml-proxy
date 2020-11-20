"use strict";

// This module is a bit confused re: it's purpose. It exports a method to
// construct a DynamoDB handle and methods to use that handle. It should
// probably export an object that ties methods to a particular handle. Alas
// that will have to wait until we have a proper test suite in place.
const AWS = require("aws-sdk");
function createDynamoHandle(awsConfig, local) {

  let dynamoDb;
  if (local) {
    awsConfig.endpoint = `http://${local}`;
    dynamoDb = new AWS.DynamoDB({ endpoint: `http://${local}` });
    AWS.config.update({
      region: "us-west-2",
      endpoint: `http://${local}`
    });
    dynamoDb.docClient = new AWS.DynamoDB.DocumentClient();
  } else {
    AWS.config.update(awsConfig);
    dynamoDb =  new AWS.DynamoDB();
    dynamoDb.docClient = new AWS.DynamoDB.DocumentClient();
  }

  return dynamoDb;
}

function getFromDynamoBySecondary(client, key, value, TableName) {
  const params = {
    IndexName: `oauth_${key}_index`,
    KeyConditionExpression: "#key= :k",
    ExpressionAttributeNames: {
      "#key": key,
    },
    ExpressionAttributeValues: {
      ":k": {
        S: value,
      },
    },
    TableName,
  };

  return new Promise((resolve, reject) => {
    client.query(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Items[0]);
      }
    });
  });
}

function getFromDynamoByState(client, state, TableName) {
  const params = {
    Key: {
      state: {
        S: state,
      },
    },
    TableName,
  };

  return new Promise((resolve, reject) => {
    client.getItem(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Item);
      }
    });
  });
}

function getFromDynamoByAccessToken(client, access_token, TableName) {
  const params = {
    Key: {
      access_token: {
        S: access_token,
      },
    },
    TableName,
  };

  return new Promise((resolve, reject) => {
    client.getItem(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data.Item);
      }
    });
  });
}

function saveToDynamo(client, state, key, value, TableName) {
  const params = {
    ExpressionAttributeNames: {
      "#K": key,
    },
    ExpressionAttributeValues: {
      ":k": {
        S: value,
      },
    },
    Key: {
      state: {
        S: state,
      },
    },
    ReturnValues: "ALL_NEW",
    UpdateExpression: "SET #K = :k",
    TableName,
  };

  return new Promise((resolve, reject) => {
    client.updateItem(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function saveToDynamoAccessToken(client, accessToken, key, value, TableName) {
  const params = {
    ExpressionAttributeNames: {
      "#K": key,
    },
    ExpressionAttributeValues: {
      ":k": {
        S: value,
      },
    },
    Key: {
      access_token: {
        S: accessToken,
      },
    },
    ReturnValues: "ALL_NEW",
    UpdateExpression: "SET #K = :k",
    TableName,
  };

  return new Promise((resolve, reject) => {
    client.updateItem(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function awsConfigFrom(config) {
  let dynamoDbConfig =  Object.assign(
    {},
    { region: config.aws_region },
    config.aws_id === null ? null : { accessKeyId: config.aws_id },
    config.aws_secret === null ? null : { secretAccessKey: config.aws_secret }
  );
  
  if (config.dynamo_local) {
    dynamoDbConfig.endpoint = `http://${config.dynamo_local}`
  }
  return dynamoDbConfig;
}

function savePayloadToDynamo(dynamoDb, payload, tableName) {
  // var awsConfig = awsConfigFrom(config);
  var AWS = require("aws-sdk");
  // AWS.config.update({
  //   awsConfig
  // });
  // var docClient = new DynamoDB.DocumentClient();

  var params = {
    TableName:tableName,
    Item:{
    }
  };

  Object.assign(params.Item, payload);


  return new Promise((resolve, reject) => {
    
    dynamoDb.docClient.put(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

module.exports = {
  createDynamoHandle,
  saveToDynamo,
  getFromDynamoByState,
  getFromDynamoByAccessToken,
  saveToDynamoAccessToken,
  getFromDynamoBySecondary,
  savePayloadToDynamo,
};
