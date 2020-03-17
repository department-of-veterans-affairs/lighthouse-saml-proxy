function statusCodeFromError(error) {
  if(error.response && error.response.statusCode) {
    return error.response.statusCode;
  }
  return 500;
}

function stopTimer(gauge, start) {
  const end = process.hrtime.bigint();
  gauge.set(Number(end - start)/1000000000);
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
  stopTimer
}
