const yargs = require('yargs');

function processArgs() {
  return yargs
    .usage('Proxy for OpenId Connect Server')
    .env()
    .config()
    .options({
      port: {
        description: 'Port for Proxy to list',
        required: true,
        default: 7100,
      },
      host: {
        description: 'host of oauth-proxy in the form of protocol://domain:port',
        required: true
      },
      upstream_issuer: {
        description: 'URI of upstream issuer to be proxies',
        required: true,
      },
      upstream_issuer_timeout_ms: {
        description: 'Optional timeout (ms) for upstream requests',
        required: false
      },
      aws_secret: {
        description: "AWS Secret Access Key",
        required: false,
        default: null,
      },
      aws_id: {
        description: "AWS Access ID",
        required: false,
        default: null,
      },
      aws_region: {
        description: "AWS Region",
        required: true,
        default: 'us-west-2',
      },
      dynamo_local: {
        description: "flag to use local DynamoDB instance",
        required: false,
      },
      okta_url: {
        description: "base URL of okta organization",
        required: true,
      },
      okta_token: {
        description: "okta API token",
        required: true,
      },
      validate_endpoint: {
        description: 'va.gov token validation endpoint',
        required: true,
        default: 'https://sandbox-api.va.gov/internal/auth/v0/validation'
      },
      validate_apiKey: {
        description: 'apiKey permitting access to validate endpoint',
      },
      idp: {
        description: 'Okta IDP identifier to be added as a query param (idp) if not specified by user in authorize request'
      },
      sentry_dsn: {
        description: 'URL of the sentry project to send errors',
        required: false,
        string: true
      },
      sentry_environment: {
        description: 'Environment of the Sentry project',
        required: false,
        string: true
      },
      enable_pkce_authorization_flow: {
        description: "Enable PKCE authorization flow?",
        required: false,
        default: false,
      }
    })
    .wrap(yargs.terminalWidth())
    .argv;
}

module.exports = {
  processArgs,
};
