const axios = require("axios");
const qs = require("qs");

class ClientCredentialsStrategy {
  constructor(req, logger, dynamo, dynamoClient, token_endpoint) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.token_endpoint = token_endpoint;
  }

  //will throw error if cannot retrieve refresh token
  async getTokenResponse() {
    let token;
    let res;

    delete this.req.headers.host;
    var data = qs.stringify(this.req.body);
    try {
      res = await axios({
        method: "post",
        url: this.token_endpoint,
        data: data,
        headers: this.req.headers,
      });
      if (res.status == 200) {
        token = res.data;
      } else {
        throw {
          statusCode: 500,
          error: "token_failure",
          error_description: "Failed to retrieve access_token.",
        };
      }
    } catch (error) {
      if (error.response.status == 400) {
        throw {
          statusCode: 400,
          error: error.response.data.errorCode,
          error_description: error.response.data.errorSummary,
        };
      } else if (error.response.status == 401) {
        throw {
          statusCode: 401,
          error: error.response.data.error,
          error_description: error.response.data.error_description,
        };
      } else {
        throw {
          statusCode: 500,
          error: "token_failure",
          error_description: "Failed to retrieve access_token.",
        };
      }
    }

    return token;
  }

  async pullDocumentFromDynamo() {
    //Currently unused, follow on to pull & store launch context
  }

  // eslint-disable-next-line no-unused-vars
  async saveDocumentToDynamo(document, tokens) {
    //Currently unused, follow on to pull & store launch context
  }

  // eslint-disable-next-line no-unused-vars
  async createPatientInfo(tokens, decoded) {
    //TODO: some validation on the request body would be good here
    return this.req.body.launch;
  }
}

module.exports = { ClientCredentialsStrategy };
