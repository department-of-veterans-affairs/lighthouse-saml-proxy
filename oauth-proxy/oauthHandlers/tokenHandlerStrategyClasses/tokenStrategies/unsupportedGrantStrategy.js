class UnsupportedGrantStrategy {
  constructor() {}

  async getToken() {
    throw {
      statusCode: 400,
      error: "unsupported_grant_type",
      error_description:
        "Only authorization_code, refresh_token, and client_credentials grant types are supported",
    };
  }
}

module.exports = { UnsupportedGrantStrategy };
