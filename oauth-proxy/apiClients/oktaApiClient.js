const deleteUserGrantOnClient = async (oktaClient, userId, clientId) => {
  return await oktaClient.revokeGrantsForUserAndClient(userId, clientId);
};

const getUserIds = async (oktaClient, email) => {
  let emailFilter = 'profile.email eq "' + email + '"';
  let userIds = [];

  await oktaClient
    .listUsers({ search: emailFilter })
    .each((user) => userIds.push(user.id))
    .catch((err) => {
      throw err;
    });

  if (!userIds.length) {
    throw { status: 400, errorMessage: "Invalid email" };
  }

  return userIds;
};

const getClientInfo = async (oktaClient, clientId) => {
  let response = await oktaClient.getApplication(clientId);
  return response.oauthClient;
};

const getAuthorizationServerInfo = async (
  authorizationServerId,
  oktaClient
) => {
  return await oktaClient.getAuthorizationServer(authorizationServerId);
};

const getClaims = async (authorizationServerId, oktaClient) => {
  let claims = [];
  const claimsCollection = await oktaClient.listOAuth2Claims(
    authorizationServerId
  );
  await claimsCollection.each((claim) => {
    claims.push(claim.name);
  });
  return claims;
};

module.exports = {
  deleteUserGrantOnClient,
  getUserIds,
  getClientInfo,
  getAuthorizationServerInfo,
  getClaims,
};
