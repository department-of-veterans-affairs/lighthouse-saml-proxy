class TokenHandlerError extends error{
  constructor(error, error_description, statusCode, sentry = false, ...params) {
    this.name = "TokenHandlerError"
    this.error = error;
    this.error_description = error_description;
    this.statusCode = statusCode;
    this.sentry = sentry;
    super(...params);
  }
}

module.exports = { TokenHandlerError };