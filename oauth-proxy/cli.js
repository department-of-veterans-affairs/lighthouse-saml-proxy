const yargs = require('yargs');

function processArgs() {
  return yargs
    .usage('Proxy for OpenId Connect Server')
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
      }
    })
    .wrap(yargs.terminalWidth())
    .argv;
}

module.exports = {
  processArgs,
}

