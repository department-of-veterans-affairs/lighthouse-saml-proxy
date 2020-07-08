const axios = require('axios');
const uriTemplates = require('uri-templates');
const URI = require('urijs');

const deleteUserGrantOnClient = async (config, userId, clientId) => {
  let error;
  let response;
  const template = uriTemplates(config.okta_url+"/api/v1/users/{userid}/clients/{clientid}/grants")
  await axios({
      method: "DELETE",
      url: template.fill({userid: userId, clientid: clientId}),
      headers: {Authorization: "SSWS "+config.okta_token}
    }).then(res => {
      response = res})
    .catch(err => {error = err})
  
  if(response == null){
    throw error;
  }
  
  return response;
}

const getUserInfo = async (config, email) => {
  //Assume that the email is passed into this method unencoded.
  let uri = URI(config.okta_url+"/api/v1/users");
  uri.search({q: email})
  
  let response;
  let error;

  await axios({
    method: "GET",
    url: uri.toString(),
    headers: {Authorization: "SSWS "+config.okta_token}
  }).then(res => {
    response = res})
  .catch(err => {error = err})

  if(response == null){
    throw error;
  }
  
  return response;
}

module.exports = { deleteUserGrantOnClient, getUserInfo };