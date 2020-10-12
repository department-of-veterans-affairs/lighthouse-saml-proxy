const uriTemplates = require("uri-templates");
const URI = require("urijs");
const okta = require('@okta/okta-sdk-nodejs');

const deleteUserGrantOnClient = async (oktaClient, config, userId, clientId) => {
  let error;
  let response;
  const template = uriTemplates(
    config.okta_url + "/api/v1/users/{userid}/clients/{clientid}/grants"
  );
  
  await oktaClient.http.http(template.fill({ userid: userId, clientid: clientId }), {method: 'DELETE'})
    .then(res => res.text())
    .then(text => response = JSON.parse(text))
    .catch ((err) => error = err);
  
  if (response == null) {
    throw error;
  }

  return response;
};

const getUserIds = async (okta_client, email) => {
  let emailFilter = 'profile.email eq "' + email + '"';
  let userIds = [];

  await okta_client.listUsers({
    search: emailFilter
  })
  .each(user => userIds.push(user.id))
  .catch(err => {throw err});

  if (!userIds.length) {
    throw {status: 400, errorMessage: "Invalid email"};
  }

  return userIds;
};

const getClientInfo = async (oktaClient, config, clientId) => {
  const template = uriTemplates(
    config.okta_url + "/oauth2/v1/clients/{clientid}"
  );

  let response = await callOktaEndpoint(oktaClient, template.fill({ clientid: clientId }));
  return response;
};

const getAuthorizationServerInfo = async (config, authorizationServerId, oktaClient) => {
  let error;
  let response;
  const template = uriTemplates(
    config.okta_url + "/api/v1/authorizationServers/{authorizationServerId}"
  );

  await oktaClient.http.http(template.fill({ authorizationServerId: authorizationServerId }), {method: 'get'})
  .then(res => res.text())
  .then(text => response = JSON.parse(text))
  .catch ((err) => error = err);

  if (response == null) {
    throw error;
  }
  return response;
};

const getClaims = async (authorizationServerId, oktaClient) => {
  let claims = [];
  const claimsCollection = await oktaClient.listOAuth2Claims(authorizationServerId);
  await claimsCollection.each(claim => {
    claims.push(claim.name);
  })
  return claims;
}

module.exports = {
  deleteUserGrantOnClient,
  getUserIds,
  getClientInfo,
  getAuthorizationServerInfo,
  getClaims
};

async function callOktaEndpoint(oktaClient, oktaUrl, method) {
  let error;
  let response;
  method = method === undefined ? 'get' : method;
  await oktaClient.http.http(oktaUrl, { method: method })
    .then(res => res.text())
    .then(text => response = JSON.parse(text))
    .catch((err) => error = err);

  if (response == null) {
    throw error;
  }
  return response;
}

