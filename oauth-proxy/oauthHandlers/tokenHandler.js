const { rethrowIfRuntimeError, parseBasicAuth } = require("../utils");
const {
  buildTokenHandlerClient,
} = require("./tokenHandlerStrategyClasses/tokenHandlerClientBuilder");

const tokenHandler = async (
  config,
  redirect_uri,
  logger,
  issuer,
  dynamo,
  dynamoClient,
  validateToken,
  req,
  res,
  next
) => {
  let tokenHandlerClient;
  try {
    let metadata = createClientMetadata(redirect_uri, req, config);
    tokenHandlerClient = buildTokenHandlerClient(
      redirect_uri,
      issuer,
      logger,
      dynamo,
      dynamoClient,
      config,
      req,
      metadata,
      validateToken
    );
  } catch (error) {
    rethrowIfRuntimeError(error);
    res.status(error.status).json({
      error: error.error,
      error_description: error.error_description,
    });
    return next();
  }

  let tokenResponse;
  try {
    tokenResponse = await tokenHandlerClient.handleToken();
  } catch (err) {
    return next(err);
  }
  res.status(tokenResponse.statusCode).json(tokenResponse.responseBody);
  return next();
};

function createClientMetadata(redirect_uri, req, config) {
  let clientMetadata = {
    redirect_uris: [redirect_uri],
  };

  const basicAuth = parseBasicAuth(req);
  if (basicAuth) {
    clientMetadata.client_id = basicAuth.username;
    clientMetadata.client_secret = basicAuth.password;
  } else if (req.body.client_id && req.body.client_secret) {
    clientMetadata.client_id = req.body.client_id;
    clientMetadata.client_secret = req.body.client_secret;
    delete req.body.client_id;
    delete req.body.client_secret;
  } else if (config.enable_pkce_authorization_flow && req.body.client_id) {
    clientMetadata.token_endpoint_auth_method = "none";
    clientMetadata.client_id = req.body.client_id;
    delete req.body.client_id;
  } else {
    throw {
      error: "invalid_client",
      error_description: "Client authentication failed",
    };
  }
  return clientMetadata;
}

module.exports = tokenHandler;
