const process = require('process');
const { revokationGauge, stopTimer } = require('./metrics');
const axios = require('axios');
const qs = require('querystring');

// This results in revoking a access_token or a refresh_token.

const revokeToken = async (endpoint, access_token, target_token, target_token_type) => {
    const revokeTokenStart = process.hrtime.bigint();
    const config = {
      headers: {
        'Content-Type': `application/x-www-form-urlencoded`,
        authorization: `Bearer ${access_token}`
      }
    };
    const requestBody = {
        token: target_token,
        token_type_hint: target_token_type // Valid values are `access_token` and `refresh_token`.	
    };

    const response = await axios.post(endpoint, qs.stringify(requestBody), config);
    stopTimer(revokationGauge, revokeTokenStart);
    return response;
  };
  
  // Returns a function that calls revokeToken with the given configuration
  // parameters.
  const configureTokenRevocation = (endpoint) => {
    return (access_token, target_token, target_token_type) => {
      return revokeToken(endpoint, access_token, target_token, target_token_type);
    };
  };
  
  module.exports = {
    revokeToken: revokeToken,
    configureTokenRevocation: configureTokenRevocation,
  };