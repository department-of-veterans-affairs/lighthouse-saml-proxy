function statusCodeFromError(error) {
  if(error.response && error.response.statusCode) {
    return error.response.statusCode;
  }
  return 500;
}

const isRuntimeError = (err) => {
  return (
    (err instanceof EvalError)
    || (err instanceof ReferenceError)
    || (err instanceof RangeError)
    || (err instanceof SyntaxError)
    || (err instanceof TypeError)
  );
};

const rethrowIfRuntimeError = (err) => {
  if (isRuntimeError(err)) {
    throw err;
  }
};

function encodeBasicAuthHeader(username, password) {
  const encodedCredentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${encodedCredentials}`;
}

module.exports = {
  isRuntimeError,
  rethrowIfRuntimeError,
  statusCodeFromError,
  encodeBasicAuthHeader,
}
