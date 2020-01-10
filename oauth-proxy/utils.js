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

module.exports = {
  isRuntimeError,
  rethrowIfRuntimeError,
  statusCodeFromError,
}
