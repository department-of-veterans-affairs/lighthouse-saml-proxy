const axios = require('axios');
const { deleteUserGrantOnClient, getUserInfo } = require('../apiClients/oktaApiClient');

const revokeUserGrantHandler = async (config, req, res, next) => {
    if(!config.enable_okta_consent_endpoint){
        res.status(403).json({
            error: "invalid_request",
            error_description: "Revoking grants is disabled in this environment.",
        })
        return next()
    }

    let client_id = req.body.client_id;
    let email = req.body.email;
    let errorMessage = "";

    if(!client_id || client_id == ""){
        errorMessage += "Client Id is a required parameter. "
    }

    if(!email || email == ""){
        errorMessage += "User Id is a required parameter. "
    }

    if(errorMessage.length > 0){
        res.status(400).json({
            error: "invalid_request",
            error_description: errorMessage,
        })
        return next()
    }

    let userIds;

    await getUserInfo(config, email)
    .then(response => userIds = grabUserIds(response.data))
    .catch(() => errorMessage += "Could not find user from email address: "+email)

    if(errorMessage.length > 0 || userIds == null){
        res.status(404).json({
            error: "invalid_request",
            error_description: errorMessage,
        })
        return next();
    }

    let responses = [];
    let status = 200;

    for (var i = 0; i < userIds.length; i++){
        await deleteGrantsOnClientAndUserId(config, userIds[i], client_id)
        .then(response => responses.push(response))
        .catch(err => {
            status = 400;
            responses.push(err);
        })
    }

    res.status(status).json({"email": email, "responses": responses});
}

const deleteGrantsOnClientAndUserId = async (config, userId, clientId) => {
    await deleteUserGrantOnClient(config, userId, clientId)
        .then((response) => {
            retValue = {"status": response.status, "userId": userId, "message": "Okta grants successfully revoked"};
        })
        .catch((err) => {
            throw {"status": err.response.status, "userId": userId, "message": err.response.data.errorSummary};
        })
        
    return retValue;
}

const grabUserIds = (data) => {
    let userIds = [];
    data.forEach((obj) => {
        userIds.push(obj.id);
    })
    return userIds;
}

module.exports = revokeUserGrantHandler;