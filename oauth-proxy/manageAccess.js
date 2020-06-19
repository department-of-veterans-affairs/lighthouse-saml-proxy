const process = require('process');
const { validationGauge, stopTimer } = require('./metrics');
const axios = require('axios');



const manageAccess = async (endpoint, api_key, access_token) => {
  const manageAccessStart = process.hrtime.bigint();
  const config = {
    headers: {
      apiKey: api_key,
      authorization: `Bearer ${access_token}`
    }
  };
  const response = await axios.get(endpoint, config);
  stopTimer(validationGauge, manageAccessStart);
  return response.data.data.attributes;
};

// Returns a function that calls manageAccess with the given configuration
// parameters.
const configureAcessManager = (endpoint, api_key) => {
  return (access_token) => {
    return manageAccess(endpoint, api_key, access_token);
  };
};

module.exports = {
  manageAccess: manageAccess,
  configureTokenValidator: configureTokenValidator,
};
