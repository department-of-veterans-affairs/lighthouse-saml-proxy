const { processArgs } = require('../cli');
const axios = require('axios');

const config = processArgs();
const apiUrl = config.okta_url+"/api/v1/"

const deleteUserGrantOnClient = async (userId, ssws, clientId) => {
  let error;
  let response;
  await axios({
      method: "DELETE",
      url: apiUrl+"users/"+userId+"/clients/"+clientId+"/grants",
      headers: {Authorization: "SSWS "+ssws}
    }).then(res => {
      response = res})
    .catch(err => {error = err})
  
  if(response == null){
    throw error;
  }
  
  return response;

}

module.exports = deleteUserGrantOnClient;