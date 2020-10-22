class UnsupportedGrantStrategy {
  constructor() { }

  //will throw error if cannot retrieve refresh token
  async getToken(client, redirect_uri) { // eslint-disable-line
    throw {
      statusCode: 401,
      error: "invalid_client",
      error_description: "Client authentication failed",
    };
  }
}

module.exports = { UnsupportedGrantStrategy };