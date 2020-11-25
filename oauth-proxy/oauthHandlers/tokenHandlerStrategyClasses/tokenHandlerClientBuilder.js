const { hashString } = require("../../utils");
const {
  RefreshTokenStrategy,
} = require("./tokenStrategies/refreshTokenStrategy");
const {
  AuthorizationCodeStrategy,
} = require("./tokenStrategies/authorizationCodeStrategy");
const {
  ClientCredentialsStrategy,
} = require("./tokenStrategies/clientCredentialsStrategy");
const {
  UnsupportedGrantStrategy,
} = require("./tokenStrategies/unsupportedGrantStrategy");
const { TokenHandlerClient } = require("./tokenHandlerClient");
const {
  PullDocumentByCodeStrategy,
} = require("./pullDocumentStrategies/pullDocumentByCodeStrategy");
const {
  PullDocumentByRefreshTokenStrategy,
} = require("./pullDocumentStrategies/pullDocumentByRefreshTokenStrategy");
const {
  PullDocumentByLaunchStrategy,
} = require("./pullDocumentStrategies/pullDocumentByLaunchStrategy");
const {
  SaveDocumentStateStrategy,
} = require("./saveDocumentStrategies/saveDocumentStateStrategy");
const {
  SaveDocumentLaunchStrategy,
} = require("./saveDocumentStrategies/saveDocumentLaunchStrategy");
const {
  GetPatientInfoFromValidateEndpointStrategy,
} = require("./getPatientInfoStrategies/getPatientInfoFromValidateEndpointStrategy");
const {
  GetPatientInfoFromLaunchStrategy,
} = require("./getPatientInfoStrategies/getPatientInfoFromLaunchStrategy");
const { parseBasicAuth } = require("../../utils");
const buildTokenHandlerClient = (
  redirect_uri,
  issuer,
  logger,
  dynamo,
  dynamoClient,
  config,
  req,
  res,
  next,
  validateToken
) => {
  const strategies = getStrategies(
    redirect_uri,
    issuer,
    logger,
    dynamo,
    dynamoClient,
    config,
    req,
    validateToken
  );
  return new TokenHandlerClient(
    strategies.tokenHandlerStrategy,
    strategies.pullDocumentFromDynamoStrategy,
    strategies.saveDocumentToDynamoStrategy,
    strategies.getPatientInfoStrategy,
    req,
    res,
    next
  );
};

const getStrategies = (
  redirect_uri,
  issuer,
  logger,
  dynamo,
  dynamoClient,
  config,
  req,
  validateToken
) => {
  let strategies;
  if (req.body.grant_type === "refresh_token") {
    strategies = {
      tokenHandlerStrategy: new RefreshTokenStrategy(
        req,
        logger,
        new issuer.Client(createClientMetadata(redirect_uri, req, config))
      ),
      pullDocumentFromDynamoStrategy: new PullDocumentByRefreshTokenStrategy(
        req,
        logger,
        dynamo,
        dynamoClient,
        config
      ),
      saveDocumentToDynamoStrategy: new SaveDocumentStateStrategy(
        req,
        logger,
        dynamo,
        dynamoClient,
        config
      ),
      getPatientInfoStrategy: new GetPatientInfoFromValidateEndpointStrategy(
        validateToken,
        logger
      ),
    };
  } else if (req.body.grant_type === "authorization_code") {
    strategies = {
      tokenHandlerStrategy: new AuthorizationCodeStrategy(
        req,
        logger,
        redirect_uri,
        new issuer.Client(createClientMetadata(redirect_uri, req, config))
      ),
      pullDocumentFromDynamoStrategy: new PullDocumentByCodeStrategy(
        req,
        logger,
        dynamo,
        dynamoClient,
        config
      ),
      saveDocumentToDynamoStrategy: new SaveDocumentStateStrategy(
        req,
        logger,
        dynamo,
        dynamoClient,
        config
      ),
      getPatientInfoStrategy: new GetPatientInfoFromValidateEndpointStrategy(
        validateToken,
        logger
      ),
    };
  } else if (req.body.grant_type === "client_credentials") {
    if (
      req.body.client_assertion_type !==
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
    ) {
      throw {
        status: 400,
        error: "invalid_request",
        error_description: "Client assertion type must be jwt-bearer.",
      };
    }
    strategies = {
      tokenHandlerStrategy: new ClientCredentialsStrategy(
        req,
        logger,
        dynamo,
        dynamoClient,
        issuer.token_endpoint
      ),
      pullDocumentFromDynamoStrategy: new PullDocumentByLaunchStrategy(req),
      saveDocumentToDynamoStrategy: new SaveDocumentLaunchStrategy(
        logger,
        dynamo,
        dynamoClient,
        config,
        hashString
      ),
      getPatientInfoStrategy: new GetPatientInfoFromLaunchStrategy(req),
    };
  } else {
    strategies = { tokenHandlerStrategy: new UnsupportedGrantStrategy() };
  }
  return strategies;
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
      status: 401,
      error: "invalid_client",
      error_description: "Client authentication failed",
    };
  }
  return clientMetadata;
}

module.exports = { buildTokenHandlerClient };
