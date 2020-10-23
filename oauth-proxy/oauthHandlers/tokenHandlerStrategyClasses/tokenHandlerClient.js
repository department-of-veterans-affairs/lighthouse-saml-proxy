const jwtDecode = require("jwt-decode");

const { rethrowIfRuntimeError, parseBasicAuth } = require("../../utils");
const { translateTokenSet } = require("../tokenResponse");

class TokenHandlerClient {
  constructor(
    tokenHandlerStrategy,
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
  ) {
    this.tokenHandlerStrategy = tokenHandlerStrategy;
    this.config = config;
    this.redirect_uri = redirect_uri;
    this.logger = logger;
    this.issuer = issuer;
    this.dynamo = dynamo;
    this.dynamoClient = dynamoClient;
    this.validateToken = validateToken;
    this.req = req;
    this.res = res;
    this.next = next;
  }
  async handleToken() {
    let clientMetadata = this.createClientMetaData();

    const client = new this.issuer.Client(clientMetadata);

    let tokens = await this.tokenHandlerStrategy.getToken(
      client,
      this.redirect_uri
    );

    let document = await this.tokenHandlerStrategy.pullDocumentFromDynamo();
    let state;
    if (document && tokens) {
      this.tokenHandlerStrategy.saveDocumentToDynamo(document, tokens);
      state = document.state.S;
    }

    //Creates a Token Response
    const tokenResponseBase = translateTokenSet(tokens);
    var decoded = jwtDecode(tokens.access_token);
    if (decoded.scp != null && decoded.scp.indexOf("launch/patient") > -1) {
      let patient = await this.createPatientInfo(tokens, decoded);
      return { ...tokenResponseBase, patient, state };
    }

    return { ...tokenResponseBase, state };
  }

  createClientMetaData() {
    let clientMetadata = {
      redirect_uris: [this.redirect_uri],
    };

    const basicAuth = parseBasicAuth(this.req);
    if (basicAuth) {
      clientMetadata.client_id = basicAuth.username;
      clientMetadata.client_secret = basicAuth.password;
    } else if (this.req.body.client_id && this.req.body.client_secret) {
      clientMetadata.client_id = this.req.body.client_id;
      clientMetadata.client_secret = this.req.body.client_secret;
      delete this.req.body.client_id;
      delete this.req.body.client_secret;
    } else if (
      this.config.enable_pkce_authorization_flow &&
      this.req.body.client_id
    ) {
      clientMetadata.token_endpoint_auth_method = "none";
      clientMetadata.client_id = this.req.body.client_id;
      delete this.req.body.client_id;
    } else {
      throw {
        statusCode: 401,
        error: "invalid_client",
        error_description: "Client authentication failed",
      };
    }
    return clientMetadata;
  }

  async createPatientInfo(tokens, decoded) {
    let patient;
    try {
      const validation_result = await this.validateToken(
        tokens.access_token,
        decoded.aud
      );
      patient = validation_result.va_identifiers.icn;
    } catch (error) {
      rethrowIfRuntimeError(error);
      let returnError = {
        statusCode: 400,
        error: "invalid_grant",
        error_description:
          "Could not find a valid patient identifier for the provided authorization code.",
      };
      this.logger.error(returnError.error_description, error);
      throw returnError;
    }
    return patient;
  }
}

module.exports = { TokenHandlerClient };
