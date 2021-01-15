"use strict";
const AWS = require("aws-sdk");

class DynamoClient {
  constructor(awsConfig, local) {
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

    this.dynamoDb = dynamoDb;
  }

  savePayloadToDynamo(payload, tableName) {
    var params = {
      TableName: tableName,
      Item: {},
    };

    Object.assign(params.Item, payload);

    return new Promise((resolve, reject) => {
      this.dynamoDb.dbDocClient.put(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  scanFromDynamo(tableName) {
    var params = {
      TableName: tableName,
    };

    return new Promise((resolve, reject) => {
      this.dynamoDb.dbDocClient.scan(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  getPayloadFromDynamo(searchAttributes, tableName) {
    var params = {
      TableName: tableName,
      Key: {},
    };

    Object.assign(params.Key, searchAttributes);

    return new Promise((resolve, reject) => {
      this.dynamoDb.dbDocClient.get(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  queryFromDynamo(
    conditionExpression,
    attributeNames,
    attributeValues,
    tableName,
    indexName
  ) {
    var params = {
      TableName: tableName,
      KeyConditionExpression: conditionExpression,
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {},
    };
    if (indexName) {
      params.IndexName = indexName;
    }
    Object.assign(params.ExpressionAttributeNames, attributeNames);
    Object.assign(params.ExpressionAttributeValues, attributeValues);

    return new Promise((resolve, reject) => {
      this.dynamoDb.dbDocClient.query(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  updateToDynamo(recordKey, payload, tableName) {
    var params = {
      TableName: tableName,
      Key: {},
      ReturnValues: "UPDATED_NEW",
    };
    Object.assign(params.Key, recordKey);
    params.UpdateExpression = "set ";
    params.ExpressionAttributeValues = {};
    Object.entries(payload).forEach((entry) => {
      const [key, value] = entry;
      console.log(key, value);
      params.UpdateExpression += key + " = :" + key + ",";
      params.ExpressionAttributeValues[":" + key] = value;
    });
    params.UpdateExpression = params.UpdateExpression.slice(0, -1);
    return new Promise((resolve, reject) => {
      this.dynamoDb.dbDocClient.update(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
}
module.exports = {
  DynamoClient,
};
