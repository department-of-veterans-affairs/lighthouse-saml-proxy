class UnsupportedGrantStrategy {
  constructor() {}

  async getToken() {
    throw {
      statusCode: 400,
      error: "invalid_request",
      error_description:
        "Only authorization_code, refresh_token, and client_credentials grant types are supported",
    };
  }
}

module.exports = { UnsupportedGrantStrategy };
