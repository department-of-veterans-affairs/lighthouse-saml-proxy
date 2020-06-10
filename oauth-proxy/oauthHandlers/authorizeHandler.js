const { URLSearchParams } = require('url');
const { loginBegin } = require('../metrics');

const authorizeHandler = async (config, redirect_uri, logger, issuer, dynamo, dynamoClient, oktaClient, req, res, next) => {
  loginBegin.inc();
  const { state, client_id, redirect_uri: client_redirect } = req.query;

  if(state == null) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "State parameter required",
    })
    return next()
  }

  try {
    const oktaApp = await oktaClient.getApplication(client_id);
    if (oktaApp.settings.oauthClient.redirect_uris.indexOf(client_redirect) === -1) {
      const errorParams = new URLSearchParams({
        error: 'invalid_client',
        error_description: 'The redirect URI specified by the application does not match any of the ' +
        `registered redirect URIs. Erroneous redirect URI: ${client_redirect}`
      });
      return res.redirect(`${client_redirect}?${errorParams.toString()}`);
    }
  } catch (error) {
    logger.error("Unrecoverable error: could not get the Okta client app", error);
    // This error is unrecoverable because we would be unable to verify
    // that we are redirecting to a whitelisted client url
    return next(error);
  }

  try {
    await dynamoClient.saveToDynamo(dynamo, state, "redirect_uri", client_redirect);
  } catch (error) {
    logger.error(`Failed to save client redirect URI ${client_redirect} in authorize handler`);
    return next(error); // This error is unrecoverable because we can't create a record to lookup the requested redirect
  }
  const params = new URLSearchParams(req.query);
  params.set('redirect_uri', redirect_uri);
  if (!params.has('idp') && config.idp) {
    params.set('idp', config.idp);
  }

  res.redirect(`${issuer.metadata.authorization_endpoint}?${params.toString()}`)
};

module.exports = authorizeHandler;
