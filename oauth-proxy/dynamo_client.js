"use strict";
const AWS = require("aws-sdk");

/**
 * Acts as an adapter to the direct Dynamo DB APIs
 */
class DynamoClient {
  constructor(awsConfig, local) {
    if (local) {
      awsConfig.endpoint = `http://${local}`;
      AWS.config.update(awsConfig);
      this.dynamoDb = new AWS.DynamoDB({ endpoint: `http://${local}` });
      AWS.config.update({
        region: "us-west-2",
        endpoint: `http://${local}`,
      });
      this.dbDocClient = new AWS.DynamoDB.DocumentClient();
    } else {
      AWS.config.update(awsConfig);
      this.dynamoDb = new AWS.DynamoDB();
      AWS.config.update(awsConfig);
      this.dbDocClient = new AWS.DynamoDB.DocumentClient();
    }
  }

  /**
   * Saves the contents of payload to a record in dynamo. This will replace an existing record.
   * Use this for inserting new records or to replacement existing records.
   *
   * @param {*} payload The payload to save, which must include a field that corresponds to the primary key of the record.
   * @param {*} tableName The name of the table to save to.
   */
  savePayloadToDynamo(payload, tableName) {
    const params = {
      TableName: tableName,
      Item: {},
    };

    Object.assign(params.Item, payload);

    return new Promise((resolve, reject) => {
      this.dbDocClient.put(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Scans and returns all the records from a given dynamo db table.
   *
   * @param {*} tableName The name of the table to scan from.
   */
  scanFromDynamo(tableName) {
    const params = {
      TableName: tableName,
    };

    return new Promise((resolve, reject) => {
      this.dbDocClient.scan(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  getPayloadFromDynamo(searchAttributes, tableName) {
    const params = {
      TableName: tableName,
      Key: {},
    };

    Object.assign(params.Key, searchAttributes);

    return new Promise((resolve, reject) => {
      this.dbDocClient.get(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  queryFromDynamo(queryParams, tableName, indexName) {
    const params = {
      TableName: tableName,
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {},
    };
    if (indexName) {
      params.IndexName = indexName;
    }
    params.KeyConditionExpression = "";
    Object.entries(queryParams).forEach((entry) => {
      const [key, value] = entry;
      params.KeyConditionExpression += "#" + key + " = :" + key + " AND ";
      params.ExpressionAttributeNames["#" + key] = key;
      params.ExpressionAttributeValues[":" + key] = value;
    });
    params.KeyConditionExpression = params.KeyConditionExpression.slice(0, -5);
    return new Promise((resolve, reject) => {
      this.dbDocClient.query(params, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  updateToDynamo(recordKey, payload, tableName) {
    const params = {
      TableName: tableName,
      Key: {},
      ReturnValues: "UPDATED_NEW",
    };
    Object.assign(params.Key, recordKey);
    params.UpdateExpression = "set ";
    params.ExpressionAttributeValues = {};
    Object.entries(payload).forEach((entry) => {
      const [key, value] = entry;
      params.UpdateExpression += key + " = :" + key + ",";
      params.ExpressionAttributeValues[":" + key] = value;
    });
    params.UpdateExpression = params.UpdateExpression.slice(0, -1);
    return new Promise((resolve, reject) => {
      this.dbDocClient.update(params, (err, data) => {
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
