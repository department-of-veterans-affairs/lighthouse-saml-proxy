const process = require("process");
const { validationGauge, stopTimer } = require("./metrics");
const axios = require("axios");

// Calls the token validation API and returns the attributes provided in the
// response. If an error occurs, the axios exception is
// allowed to bubble up to the caller. You probably don't want to call this
// directly. See configureTokenValidator below for a friendlier version.

const validateToken = async (
  endpoint,
  post_endpoint,
  api_key,
  access_token,
  aud
) => {
  const validateTokenStart = process.hrtime.bigint();

  // This if/else is only required until the post validation transition
  // is completed across all environments.
  if (post_endpoint) {
    const response = await axios({
      method: "post",
      url: post_endpoint,
      headers: {
        apiKey: api_key,
        authorization: `Bearer ${access_token}`,
      },
      data: {
        aud: aud,
      },
    });
    stopTimer(validationGauge, validateTokenStart);
    return response.data.data.attributes;
  } else {
    const config = {
      headers: {
        apiKey: api_key,
        authorization: `Bearer ${access_token}`,
      },
    };
    const response = await axios.get(endpoint, config);
    stopTimer(validationGauge, validateTokenStart);
    return response.data.data.attributes;
  }
};

// Returns a function that calls validateToken with the given configuration
// parameters.
const configureTokenValidator = (endpoint, post_endpoint, api_key) => {
  return (access_token, aud) => {
    return validateToken(endpoint, post_endpoint, api_key, access_token, aud);
  };
};

module.exports = {
  validateToken: validateToken,
  configureTokenValidator: configureTokenValidator,
};
