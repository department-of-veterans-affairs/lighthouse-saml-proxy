const {
  deleteUserGrantOnClient,
  getUserInfo,
  getClientInfo,
} = require("../apiClients/oktaApiClient");
const { parseClientId } = require("../utils");
const validator = require("validator");

const revokeUserGrantHandler = async (config, req, res, next) => {
  let client_id = req.body.client_id;
  let email = req.body.email;

  try {
    await checkForValidParams(config, client_id, email);
  } catch (error) {
    setErrorResponse(res, error.status, error.errorMessage);
    return next();
  }

  let userIds;

  try {
    userIds = await getUserIds(config, email);
  } catch (error) {
    setErrorResponse(res, error.status, error.errorMessage);
    return next();
  }

  if (userIds.length < 1) {
    setErrorResponse(res, 400, "Invalid email address.");
    return next();
  }

  let revokeGrantsResponse = await revokeGrantsOnClientsAndUserIds(
    config,
    userIds,
    client_id
  );
  res
    .status(revokeGrantsResponse.status)
    .json({ email: email, responses: revokeGrantsResponse.responses });
};

module.exports = revokeUserGrantHandler;

//Helper Methods

const revokeGrantsOnClientsAndUserIds = async (config, userIds, clientId) => {
  let responses = [];
  let status = 200;

  for (var i = 0; i < userIds.length; i++) {
    await deleteGrantsOnClientAndUserId(config, userIds[i], clientId)
      .then((response) => responses.push(response))
      .catch((err) => {
        status = 400;
        responses.push(err);
      });
  }

  return { status: status, responses: responses };
};

const deleteGrantsOnClientAndUserId = async (config, userId, clientId) => {
  let retValue;
  await deleteUserGrantOnClient(config, userId, clientId)
    .then((response) => {
      retValue = {
        status: response.status,
        userId: userId,
        message: "Okta grants successfully revoked",
      };
    })
    .catch((err) => {
      throw {
        status: err.response.status,
        userId: userId,
        message: err.response.data.errorSummary,
      };
    });

  return retValue;
};

const getUserIds = async (config, email) => {
  let errorMessage;
  let userIds;
  await getUserInfo(config, email)
    .then((response) => (userIds = grabUserIdsFromUserInfo(response.data)))
    .catch(() => (errorMessage += "Invalid email address."));

  if (errorMessage) {
    throw { status: 400, errorMessage: errorMessage };
  }

  return userIds;
};

const grabUserIdsFromUserInfo = (data) => {
  let userIds = [];
  data.forEach((obj) => {
    userIds.push(obj.id);
  });
  return userIds;
};

const checkForValidParams = async (config, clientId, email) => {
  if (!config.enable_okta_consent_endpoint) {
    throw {
      status: 403,
      errorMessage: "Revoking grants is disabled in this environment.",
    };
  }

  checkIfParamsExist(clientId, email);
  checkForValidEmail(email);
  await checkForValidClient(config, clientId);
};

const checkForValidEmail = (email) => {
  if (!validator.isEmail(email)) {
    throw { status: 400, errorMessage: "Invalid email address." };
  }
};

const checkForValidClient = async (config, clientId) => {
  let clientError = true;
  if (parseClientId(clientId)) {
    await getClientInfo(config, clientId)
      .then(() => (clientError = false))
      .catch(() => (clientError = true));
  }

  if (clientError) {
    throw { status: 400, errorMessage: "Invalid client_id." };
  }
};

const checkIfParamsExist = (clientId, email) => {
  let errorMessage = "";

  if (!clientId || clientId == "") {
    errorMessage += "Invalid client_id. ";
  }

  if (!email || email == "") {
    errorMessage += "Invalid email address. ";
  }

  if (errorMessage) {
    throw { status: 400, errorMessage: errorMessage };
  }
};

const setErrorResponse = (response, status, message) => {
  response.status(status).json({
    error: "invalid_request",
    error_description: message,
  });
};
