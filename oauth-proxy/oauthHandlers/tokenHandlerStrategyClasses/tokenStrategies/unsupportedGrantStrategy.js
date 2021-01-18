class UnsupportedGrantStrategy {
  constructor() {}

  async getToken() {
    throw {
      statusCode: 400,
      error: "unsupported_grant_type",
      error_description:
        "Only authorization, refresh_token, and client_credential grant types are supported",
    };
  }
}

module.exports = { UnsupportedGrantStrategy };
