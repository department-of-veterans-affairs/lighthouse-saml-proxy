const axios = require("axios");
const uriTemplates = require("uri-templates");
const URI = require("urijs");
const { axiosCachingAdapter } = require("./axiosCachingAdapter");
const okta = require('@okta/okta-sdk-nodejs');

const deleteUserGrantOnClient = async (config, userId, clientId) => {
  let error;
  let response;
  const template = uriTemplates(
    config.okta_url + "/api/v1/users/{userid}/clients/{clientid}/grants"
  );
  await axios({
    method: "DELETE",
    url: template.fill({ userid: userId, clientid: clientId }),
    headers: { Authorization: "SSWS " + config.okta_token },
  })
    .then((res) => {
      response = res;
    })
    .catch((err) => {
      error = err;
    });

  if (response == null) {
    throw error;
  }

  return response;
};

const getUserInfo = async (config, email) => {
  let uri = URI(config.okta_url + "/api/v1/users");
  let emailFilter = `profile.email eq "${email}"`;
  uri.search({ filter: emailFilter });

  let response;
  let error;

  await axios({
    method: "GET",
    url: uri.toString(),
    headers: { Authorization: "SSWS " + config.okta_token },
  })
    .then((res) => {
      response = res;
    })
    .catch((err) => {
      error = err;
    });

  if (response == null) {
    throw error;
  }

  return response;
};

const getClientInfo = async (config, clientId) => {
  let error;
  let response;
  const template = uriTemplates(
    config.okta_url + "/oauth2/v1/clients/{clientid}"
  );

  await axios({
    method: "GET",
    url: template.fill({ clientid: clientId }),
    headers: { Authorization: "SSWS " + config.okta_token },
  })
    .then((res) => {
      response = res;
    })
    .catch((err) => {
      error = err;
    });

  if (response == null) {
    throw error;
  }

  return response;
};

const getAuthorizationServerInfo = async (config, authorizationServerId, oktaClient) => {
  let error;
  let response;
  const template = uriTemplates(
    config.okta_url + "/api/v1/authorizationServers/{authorizationServerId}"
  );

  const filledTemplate = template.fill({ authorizationServerId: authorizationServerId });
    // await axios({
    //   method: "GET",
    //   url: filledTemplate,
    //   headers: { Authorization: "SSWS " + config.okta_token },
    //   adapter: axiosCachingAdapter,
    // })
    //   .then((res) => (response = res.data))
    //   .catch((err) => (error = err));


  const okta_token = "SSWS " + config.okta_token;
  const request = {
    method: 'get'
    // headers: {
    //   'Accept': 'application/json',
    //   'Content-Type': 'application/x-www-form-urlencoded',
    //   'Authorization': okta_token,
    // }
  };
  // let claims;
  // await oktaClient.listOAuth2Claims(authorizationServerId)
  //  .then ((res) => claims = res)
  //  .catch ((err) => console.error(err));
  
  
let serverinfo
try {
  serverinfo = await oktaClient.http.http(filledTemplate, request)
  .then(res => res.text())
  .then(text => {
    console.log(text);
    serverinfo = text;
  })
} catch (err) {
  console.log(err);
}
  
  if (response == null) {
    throw error;
  }

  return response;
};

module.exports = {
  deleteUserGrantOnClient,
  getUserInfo,
  getClientInfo,
  getAuthorizationServerInfo,
};
