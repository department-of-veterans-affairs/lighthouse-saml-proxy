function buildDynamoAttributeValue(value) {
  // BEWARE: This doesn't work with number sets and a few other Dynamo types.
  if (value.constructor === String) {
    return { "S": value };
  } else if (value.constructor === Number) {
    return { "N": value.toString() };
  } else if (value.constructor === Boolean) {
    return { "BOOL": value };
  } else if (value.constructor === Array) {
    return { "L": value.map((x) => { buildDynamoAttributeValue(x) }) };
  } else if (value.constructor === Object) {
    return { "M": convertObjectToDynamoAttributeValues(value) };
  } else {
    throw new Error("Unknown type.");
  }
}

function convertObjectToDynamoAttributeValues(obj) {
  return Object.entries(obj).reduce((accum, pair) => {
    accum[pair[0]] = buildDynamoAttributeValue(pair[1]);
    return accum;
  }, {});
}

module.exports = {
  buildDynamoAttributeValue,
  convertObjectToDynamoAttributeValues,
};
