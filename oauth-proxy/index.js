const express = require('express');
const { Issuer } = require('openid-client');
const process = require('process');
const { URL, URLSearchParams } = require('url');
const bodyParser = require('body-parser');
const request = require('request');
const jwtDecode = require('jwt-decode');
const dynamoClient = require('./dynamo_client');
const { processArgs } = require('./cli')
const okta = require('@okta/okta-sdk-nodejs');
const morgan = require('morgan');
const requestPromise = require('request-promise-native');

const config = processArgs();
const oktaClient = new okta.Client({
  orgUrl: config.okta_url,
  token: config.okta_token,
  requestExecutor: new okta.DefaultRequestExecutor()
});
const { well_known_base_path } = config;
const appRoutes = {
  authorize: '/authorization',
  token: '/token',
  userinfo: '/userinfo',
  introspection: '/introspect',
  jwks: '/keys',
  redirect: '/redirect'
};
const redirect_uri = `${config.host}${well_known_base_path}${appRoutes.redirect}`;
const metadataRewrite = {
  authorization_endpoint: `${config.host}${well_known_base_path}${appRoutes.authorize}`,
  token_endpoint: `${config.host}${well_known_base_path}${appRoutes.token}`,
  userinfo_endpoint: `${config.host}${well_known_base_path}${appRoutes.userinfo}`,
  introspection_endpoint: `${config.host}${well_known_base_path}${appRoutes.introspection}`,
  jwks_uri: `${config.host}${well_known_base_path}${appRoutes.jwks}`,
};
const openidMetadataWhitelist = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "userinfo_endpoint",
  "introspection_endpoint",
  "jwks_uri",
  "scopes_supported",
  "response_types_supported",
  "response_modes_supported",
  "grant_types_supported",
  "subject_types_supported",
  "id_token_signing_alg_values_supported",
  "scopes_supported",
  "token_endpoint_auth_methods_supported",
  "claims_supported",
  "code_challenge_methods_supported",
  "introspection_endpoint_auth_methods_supported",
  "request_parameter_supported",
  "request_object_signing_alg_values_supported",
]

const smartMetadataWhitelist = [
  "authorization_endpoint",
  "token_endpoint",
  "introspection_endpoint",
  "scopes_supported",
  "response_types_supported",
]
const smartCapabilities = [
  "launch-standalone",
  "client-confidential-symmetric",
  "context-standalone-patient",
  "permission-offline",
  "permission-patient",
]

const dynamo = dynamoClient.createClient(
  Object.assign({},
    { region: config.aws_region },
    config.aws_id === null ? null : { accessKeyId: config.aws_id },
    config.aws_secret === null ? null : { secretAccessKey: config.aws_secret }
  ),
  config.dynamo_local,
  config.dynamo_table_name,
);

async function createIssuer() {
  return await Issuer.discover(config.upstream_issuer);
}

function startApp(issuer) {
  const app = express();
  const { port } = config;
  const router = new express.Router();
  app.use(morgan('combined'));
  router.use([appRoutes.token], bodyParser.urlencoded({ extended: true }));

  router.get('/.well-known/openid-configuration', (req, res) => {
    const baseMetadata = {...issuer.metadata, ...metadataRewrite }
    const filteredMetadata = openidMetadataWhitelist.reduce((meta, key) => {
      meta[key] = baseMetadata[key];
      return meta;
    }, {});

    res.json(filteredMetadata);
  });

  router.get('/.well-known/smart-configuration.json', (req, res) => {
    const baseMetadata = {...issuer.metadata, ...metadataRewrite }
    const filteredMetadata = smartMetadataWhitelist.reduce((meta, key) => {
      meta[key] = baseMetadata[key];
      return meta;
    }, {});
    filteredMetadata['capabilities'] = smartCapabilities;
    res.json(filteredMetadata);
  });

  router.get(appRoutes.jwks, async (req, res) => {
    req.pipe(request(issuer.metadata.jwks_uri)).pipe(res)
  });

  router.get(appRoutes.userinfo, async (req, res) => {
    req.pipe(request(issuer.metadata.userinfo_endpoint)).pipe(res)
  });

  router.post(appRoutes.introspection, async (req, res) => {
    req.pipe(request(issuer.metadata.introspection_endpoint)).pipe(res)
  });

  router.get(appRoutes.redirect, async (req, res, next) => {
    const { state } = req.query;
    if (!req.query.hasOwnProperty('error')) {
      try {
        await dynamoClient.saveToDynamo(dynamo, state, "code", req.query.code);
      } catch (error) {
        console.error(error);
      }
    }
    try {
      const document = await dynamoClient.getFromDynamoByState(dynamo, state);
      const params = new URLSearchParams(req.query);
      res.redirect(`${document.redirect_uri.S}?${params.toString()}`)
    } catch (error) {
      console.error(error);
      next(error); // This error is unrecoverable because we can't look up the original redirect.
    }
  });

  router.get(appRoutes.authorize, async (req, res, next) => {
    const { state, client_id, redirect_uri: client_redirect } = req.query;
    try {
      const oktaApp = await oktaClient.getApplication(client_id);
      if (oktaApp.settings.oauthClient.redirect_uris.indexOf(client_redirect) === -1) {
        const errorParams = new URLSearchParams({
          error: 'invalid_client',
          error_description: 'The specified client is not valid',
        });
        return res.redirect(`${client_redirect}?${errorParams.toString()}`);
      }
    } catch (error) {
      console.error(error);
      // This error is unrecoverable because we would be unable to verify
      // that we are redirecting to a whitelisted client url
      next(error);
    }

    try {
      await dynamoClient.saveToDynamo(dynamo, state, "redirect_uri", client_redirect);
    } catch (error) {
      console.error(error);
      next(error); // This error is unrecoverable because we can't create a record to lookup the requested redirect
    }
    const params = new URLSearchParams(req.query);
    params.set('redirect_uri', redirect_uri);
    res.redirect(`${issuer.metadata.authorization_endpoint}?${params.toString()}`)
  });

  router.post(appRoutes.token, async (req, res, next) => {
    let client_id, client_secret;

    if (req.headers.authorization) {
      const authHeader = req.headers.authorization.match(/^Basic\s(.*)$/);
      ([ client_id, client_secret ] = Buffer.from(authHeader[1], 'base64').toString('utf-8').split(':'));
    } else if (req.body.client_id && req.body.client_secret) {
      ({ client_id, client_secret } = req.body);
      delete req.body.client_id;
      delete req.body.client_secret;
    } else {
      return res.status(401).json({
        error: "invalid_client",
        error_description: "Client authentication failed",
      });
    }

    const client = new issuer.Client({
      client_id,
      client_secret,
      redirect_uris: [
        redirect_uri
      ],
    });

    let tokens, state;
    if (req.body.grant_type === 'refresh_token') {
      tokens = await client.refresh(req.body.refresh_token);
      try {
        const document = await dynamoClient.getFromDynamoBySecondary(dynamo, 'refresh_token', req.body.refresh_token);
        state = document.state.S;
        await dynamoClient.saveToDynamo(dynamo, state, 'refresh_token', tokens.refresh_token);
      } catch (error) {
        console.error(error);
        state = null;
      }
    } else if (req.body.grant_type === 'authorization_code') {
      tokens = await client.grant(
        {...req.body, redirect_uri }
      );
      try {
        const document = await dynamoClient.getFromDynamoBySecondary(dynamo, 'code', req.body.code);
        state = document.state.S;
        if (tokens.refresh_token) {
          await dynamoClient.saveToDynamo(dynamo, state, 'refresh_token', tokens.refresh_token);
        }
      } catch (error) {
        console.error(error);
        state = null;
      }
    } else {
      return res.status(400).json({
        error: "unsupported_grant_type",
        error_description: "Only authorization and refresh_token grant types are supported",
      });
    }

    var decoded = jwtDecode(tokens.access_token);
    if (decoded.scp.indexOf('launch/patient') > -1) {
      const response = await requestPromise({
        method: 'GET',
        uri: config.validate_endpoint,
        json: true,
        headers: {
          apiKey: config.validate_apiKey,
          authorization: `Bearer ${tokens.access_token}`,
        }
      });
      const patient = response.data.attributes.va_identifiers.icn;
      console.log({...tokens, patient, state});
      res.json({...tokens, patient, state});
    } else {
      res.json({...tokens, state});
    }
  });

  app.use(well_known_base_path, router)
  app.listen(port, () => console.log(`OAuth Proxy listening on port ${port}!`));
  return app;
}

(async () => {
  try {
    const issuer = await createIssuer();
    startApp(issuer);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

module.exports = {
  createIssuer,
  startApp,
}
