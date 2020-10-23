const { TokenHandlerError } = require("./tokenHandlerErrors");
class UnsupportedGrantStrategy {
  constructor() {}

  async getToken(client, redirect_uri) { // eslint-disable-line
    throw new TokenHandlerError(
      "unsupported_grant_type",
      "Only authorization and refresh_token grant types are supported",
      400
    );
  }
}

module.exports = { UnsupportedGrantStrategy };
