const express = require('express');
const { Issuer } = require('openid-client');
const process = require('process');
const { URL, URLSearchParams } = require('url');
const bodyParser = require('body-parser');
const request = require('request');
const jwtDecode = require('jwt-decode');
const dynamoClient = require('./dynamo_client');
const { processArgs } = require('./cli')

const config = processArgs();
const { redirect_uri, well_known_base_path } = config;
const metadataRewrite = {
  authorization_endpoint: config.authorization_endpoint,
  token_endpoint: config.token_endpoint,
  userinfo_endpoint: config.userinfo_endpoint,
  introspection_endpoint: config.introspection_endpoint,
  jwks_uri: config.jwks_uri,
}
const appRoutes = {
  authorize: new URL(config.authorization_endpoint).pathname,
  token: new URL(config.token_endpoint).pathname,
  userinfo: new URL(config.userinfo_endpoint).pathname,
  introspection: new URL(config.introspection_endpoint).pathname,
  jwks: new URL(config.jwks_uri).pathname,
  redirect: new URL(config.redirect_uri).pathname,
}
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
  {
    accessKeyId: config.aws_id,
    region: config.aws_region,
    secretAccessKey: config.aws_secret,
  },
  config.dynamo_local,
  config.dynamo_table_name,
);

async function createIssuer() {
  return await Issuer.discover(config.upstream_issuer);
}

function startApp(issuer) {
  const app = express();
  const { port } = config;
  app.use([appRoutes.token], bodyParser.urlencoded({ extended: true }));

  app.get(well_known_base_path + '/.well-known/openid-configuration.json', (req, res) => {
    const baseMetadata = {...issuer.metadata, ...metadataRewrite }
    const filteredMetadata = openidMetadataWhitelist.reduce((meta, key) => {
      meta[key] = baseMetadata[key];
      return meta;
    }, {});

    res.json(filteredMetadata);
  });

  app.get(well_known_base_path + '/.well-known/smart-configuration.json', (req, res) => {
    const baseMetadata = {...issuer.metadata, ...metadataRewrite }
    const filteredMetadata = smartMetadataWhitelist.reduce((meta, key) => {
      meta[key] = baseMetadata[key];
      return meta;
    }, {});
    filteredMetadata['capabilities'] = smartCapabilities;
    res.json(filteredMetadata);
  });

  app.get(appRoutes.jwks, async (req, res) => {
    req.pipe(request(issuer.metadata.jwks_uri)).pipe(res)
  });

  app.get(appRoutes.userinfo, async (req, res) => {
    console.log(req.url, req.query);
    req.pipe(request(issuer.metadata.userinfo_endpoint)).pipe(res)
  });

  app.post(appRoutes.introspection, async (req, res) => {
    req.pipe(request(issuer.metadata.introspection_endpoint)).pipe(res)
  });

  app.get(appRoutes.redirect, async (req, res) => {
    const { state } = req.query;
    if (!req.query.hasOwnProperty('error')) {
      try {
        await dynamoClient.saveToDynamo(dynamo, state, "code", req.query.code);
      } catch (error) {
        console.log(error);
      }
    }
    try {
      const document = await dynamoClient.getFromDynamoByState(dynamo, state);
    } catch (error) {
      console.log(error);
    }
    const params = new URLSearchParams(req.query);
    res.redirect(`${document.redirect_uri.S}?${params.toString()}`)
  });

  app.get(appRoutes.authorize, async (req, res) => {
    console.log(req.url, req.query);
    const { state } = req.query;
    try {
      await dynamoClient.saveToDynamo(dynamo, state, "redirect_uri", req.query.redirect_uri)
    } catch (error) {
      console.error(error);
    }
    const params = new URLSearchParams(req.query);
    params.set('redirect_uri', redirect_uri);
    res.redirect(`${issuer.metadata.authorization_endpoint}?${params.toString()}`)
  });

  app.post(appRoutes.token, async (req, res) => {
    const [ client_id, client_secret ] = Buffer.from(
      req.headers.authorization.match(/^Basic\s(.*)$/)[1], 'base64'
    ).toString('utf-8').split(':');

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
        await dynamoClient.saveToDynamo(dynamo, state, 'refresh_token', tokens.refresh_token);
      } catch (error) {
        console.error(error);
        state = null;
      }
    } else {
      throw Error('Unsupported Grant Type');
    }

    var decoded = jwtDecode(tokens.access_token);
    //const tokenData = await client.introspect(tokens.access_token);
    if (decoded.scp.indexOf('launch/patient') > -1) {
      const patient = decoded.patient;
      res.json({...tokens, patient, state});
    } else {
      res.json({...tokens, state});
    }
  });

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
