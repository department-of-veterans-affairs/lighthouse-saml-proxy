const axios = require("axios");
const qs = require("qs");

const { rethrowIfRuntimeError } = require("../../utils");

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
        //TODO: confirm appropriate error
        throw {
          status: 500,
          error: "token_failure",
          error_description: "Failed to retrieve access_token.",
        };
      }
    } catch (error) {
      rethrowIfRuntimeError(error);
      return {
        statusCode: error.statusCode,
        responseBody: {
          error: error.error,
          error_description: error.error_description,
        },
      };
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
