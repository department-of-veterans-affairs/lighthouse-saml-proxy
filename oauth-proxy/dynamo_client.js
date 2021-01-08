"use strict";

// This module is a bit confused re: it's purpose. It exports a method to
// construct a DynamoDB handle and methods to use that handle. It should
// probably export an object that ties methods to a particular handle. Alas
// that will have to wait until we have a proper test suite in place.
const AWS = require("aws-sdk");

/**
 * @deprecated, prefer a constructor with the necessary db clients encapsulated.
 */
function createDynamoHandle(awsConfig, local) {
  let dynamoDb;
  if (local) {
    awsConfig.endpoint = `http://${local}`;
    AWS.config.update(awsConfig);
    dynamoDb = new AWS.DynamoDB({ endpoint: `http://${local}` });
    AWS.config.update({
      region: "us-west-2",
      endpoint: `http://${local}`,
    });
    dynamoDb.dbDocClient = new AWS.DynamoDB.DocumentClient();
  } else {
    AWS.config.update(awsConfig);
    dynamoDb = new AWS.DynamoDB();
    AWS.config.update(awsConfig);
    dynamoDb.dbDocClient = new AWS.DynamoDB.DocumentClient();
  }

  return dynamoDb;
}

/**
 * @deprecated, prefer a successor that uses docClient.get
 */
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

/**
 * @deprecated, prefer a successor that uses docClient.get
 */
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

/**
 * @deprecated, prefer a successor that uses docClient.get
 */
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

/**
 * @deprecated - Prefer savePayloadToDynamo
 */
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

/**
 * @deprecated - Prefer savePayloadToDynamo
 */
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

function savePayloadToDynamo(dynamoDb, payload, tableName) {
  var params = {
    TableName: tableName,
    Item: {},
  };

  Object.assign(params.Item, payload);

  return new Promise((resolve, reject) => {
    dynamoDb.dbDocClient.put(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function scanFromDynamo(dynamoDb, tableName) {
  var params = {
    TableName: tableName,
  };

  return new Promise((resolve, reject) => {
    dynamoDb.dbDocClient.scan(params, function (err, data) {
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
  scanFromDynamo,
};
