const axios = require("axios");
const qs = require("qs");
const { rethrowIfRuntimeError } = require("../../../utils");

class ClientCredentialsStrategy {
  constructor(req, logger, dynamo, dynamoClient, token_endpoint) {
    this.req = req;
    this.logger = logger;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.token_endpoint = token_endpoint;
  }

  async getToken() {
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
        this.logger.error({
          message: "Server returned status code " + res.status,
        });

        throw {
          statusCode: 500,
        };
      }
    } catch (error) {
      rethrowIfRuntimeError(error);
      if (error.response && error.response.status == 400) {
        if (error.response.data.errorCode) {
          throw {
            statusCode: 400,
            error: error.response.data.errorCode,
            error_description: error.response.data.errorSummary,
          };
        } else {
          throw {
            statusCode: 400,
            error: error.response.data.error,
            error_description: error.response.data.error_description,
          };
        }
      } else if (error.response && error.response.status == 401) {
        throw {
          statusCode: 401,
          error: error.response.data.error,
          error_description: error.response.data.error_description,
        };
      } else {
        this.logger.error(
          "Failed to retrieve access_token from token endpoint."
        );
        if (error.response) {
          this.logger.error({
            message: "Server returned status code " + error.response.status,
          });
        } else {
          this.logger.error({ message: error.message });
        }
        throw {
          statusCode: 500,
        };
      }
    }

    return token;
  }
}

module.exports = { ClientCredentialsStrategy };
