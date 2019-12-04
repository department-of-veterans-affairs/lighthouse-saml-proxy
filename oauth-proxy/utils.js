function statusCodeFromError(error) {
  if(error.response && error.response.statusCode) {
    return error.response.statusCode;
  }
  return 500;
}

module.exports = {
  statusCodeFromError,
}
