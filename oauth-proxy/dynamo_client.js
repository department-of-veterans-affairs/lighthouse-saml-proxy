'use strict';

// This module is a bit confused re: it's purpose. It exports a method to
// construct a DynamoDB handle and methods to use that handle. It should
// probably export an object that ties methods to a particular handle. Alas
// that will have to wait until we have a proper test suite in place.
const { config, DynamoDB } = require('aws-sdk');

var TableName;

function createDynamoHandle(awsConfig, local, tableName) {
  config.update(awsConfig);
  TableName = tableName;

  if (local) {
    return new DynamoDB({ endpoint: `http://${local}` });
  }
  return new DynamoDB();
}

function getFromDynamoBySecondary(client, key, value) {
  const params = {
    IndexName: `oauth_${key}_index`,
    KeyConditionExpression: '#key= :k',
    ExpressionAttributeNames: {
      '#key': key,
    },
    ExpressionAttributeValues: {
      ':k': {
        'S': value,
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

function getFromDynamoByState(client, state) {
  const params = {
    Key: {
      "state": {
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

function saveToDynamo(client, state, key, value) {
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
      "state": {
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

module.exports = {
  createDynamoHandle,
  saveToDynamo,
  getFromDynamoByState,
  getFromDynamoBySecondary,
}
