const requestPromise = require('request-promise-native');

// Calls the token validation API and returns the attributes provided in the
// response. If an error occurs, the request-promise-native exception is
// allowed to bubble up to the caller. You probably don't want to call this
// directly. See configureTokenValidator below for a friendlier version.
const validateToken = async (endpoint, api_key, access_token) => {
  const response = await requestPromise({
    method: 'GET',
    uri: endpoint,
    json: true,
    headers: {
      apiKey: api_key,
      authorization: `Bearer ${access_token}`,
    }
  });

  return response.data.attributes;
};

// Returns a function that calls validateToken with the given configuration
// parameters.
const configureTokenValidator = (endpoint, api_key) => {
  return (access_token) => {
    validateToken(endpoint, api_key, access_token);
  };
};

module.exports = {
  validateToken: validateToken,
  configureTokenValidator: configureTokenValidator,
};
