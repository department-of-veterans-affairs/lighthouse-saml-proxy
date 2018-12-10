const { config, DynamoDB } = require('aws-sdk');

var TableName;

function createClient(awsConfig, local, tableName) {
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
  createClient,
  saveToDynamo,
  getFromDynamoByState,
  getFromDynamoBySecondary,
}
