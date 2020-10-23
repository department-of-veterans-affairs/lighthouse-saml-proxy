class TokenHandlerError extends Error {
  constructor(error, error_description, statusCode, sentry = false, ...params) {
    super(...params);
    this.name = "TokenHandlerError";
    this.error = error;
    this.error_description = error_description;
    this.statusCode = statusCode;
    this.sentry = sentry;
  }
}

module.exports = { TokenHandlerError };
