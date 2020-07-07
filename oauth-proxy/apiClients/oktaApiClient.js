const axios = require('axios');


const deleteUserGrantOnClient = async (config, userId, ssws, clientId) => {
  let error;
  let response;
  const apiUrl = config.okta_url+"/api/v1/"
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

module.exports = { deleteUserGrantOnClient };