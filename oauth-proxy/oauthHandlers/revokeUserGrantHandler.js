const axios = require('axios');
const { deleteUserGrantOnClient } = require('../apiClients/oktaApiClient');

const revokeUserGrantHandler = async (config, req, res, next) => {
    const { client_id, user_id } = req.query;
    const ssws = config.okta_token;
    let errorMessage = "";

    if(!client_id || client_id == ""){
        errorMessage += "Client Id is a required parameter. "
    }

    if(!user_id || user_id == ""){
        errorMessage += "User Id is a required parameter. "
    }

    if(errorMessage.length > 0){
        res.status(400).json({
            error: "invalid_request",
            error_description: errorMessage,
        })
        return next()
    }

    await deleteUserGrantOnClient(config, user_id, ssws, client_id)
        .then((response) => {
            res.status(response.status)
                .json({message: "Okta grants succesfully revoked for user: "+user_id})
        })
        .catch((err) => {
            res.status(err.response.status)
                .json({message: err.response.data.errorSummary})
        })
}

module.exports = revokeUserGrantHandler;