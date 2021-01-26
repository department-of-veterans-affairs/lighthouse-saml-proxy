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
   * @param {*} payload The payload to save, which must include a field that corresponds to the primary key of the record
   * @param {*} tableName The name of the table to save to
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
   * @param {*} tableName The name of the table to scan from
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

  /**
   * Returns the record identified by keyAttributes. Note this only works using primary keys, not secondary keys or indexes.
   *
   * @param {*} keyAttributes Object with primary keys and values for the table
   * @param {*} tableName The table to get the recordd from
   */
  getPayloadFromDynamo(keyAttributes, tableName) {
    const params = {
      TableName: tableName,
      Key: {},
    };

    Object.assign(params.Key, keyAttributes);

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

  /**
   * Queries for and returns a list of records that match queryParams.
   * Use this for searches that are based on secondary keys or indexes.
   *
   * @param {*} queryParams And object with fields and values to query from.
   * @param {*} tableName The name of the table to query against.
   * @param {*} indexName The name of the index that corresponsds to the queryParams
   */
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
    const andCondtion = " AND ";
    const condtionItems = [];
    Object.entries(queryParams).forEach((entry) => {
      const [key, value] = entry;
      condtionItems.push("#" + key + " = :" + key);
      params.ExpressionAttributeNames["#" + key] = key;
      params.ExpressionAttributeValues[":" + key] = value;
    });
    params.KeyConditionExpression = condtionItems.join(andCondtion);

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

  /**
   * Updates and augments existing records in Dyanamo DB. Use this to do updates or fields additions to an existing record.
   *
   * @param {*} recordKey An object with the fields and values that correspond to the key for the table
   * @param {*} payload The payload to update with
   * @param {*} tableName The name of the table to update to
   */
  updateToDynamo(recordKey, payload, tableName) {
    const params = {
      TableName: tableName,
      Key: {},
      ReturnValues: "UPDATED_NEW",
    };
    Object.assign(params.Key, recordKey);
    params.UpdateExpression = "set ";
    params.ExpressionAttributeValues = {};
    const updateExpressionKeys = [];
    Object.entries(payload).forEach((entry) => {
      const [key, value] = entry;
      updateExpressionKeys.push(key + " = :" + key);
      params.ExpressionAttributeValues[":" + key] = value;
    });
    params.UpdateExpression += updateExpressionKeys.join(",");
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
