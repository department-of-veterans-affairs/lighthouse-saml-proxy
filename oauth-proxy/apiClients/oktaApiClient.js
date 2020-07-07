const axios = require('axios');
const uriTemplates = require('uri-templates');

const deleteUserGrantOnClient = async (config, userId, ssws, clientId) => {
  let error;
  let response;
  const template = uriTemplates(config.okta_url+"/api/v1/users/{userid}/clients/{clientid}/grants")
  await axios({
      method: "DELETE",
      url: template.fill({userid: userId, clientid: clientId}),
      headers: {Authorization: "SSWS "+ssws}
    }).then(res => {
      response = res})
    .catch(err => {error = err})
  
  if(response == null){
    throw error;
  }
  
  return response;
}

module.exports = { deleteUserGrantOnClient };