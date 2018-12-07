const yargs = require('yargs');

function processArgs() {
  return yargs
    .usage('Proxy for OpenId Connect Server')
    .config()
    .options({
      port: {
        description: 'Port for Proxy to list',
        required: true,
        default: 8080,
      },
      redirect_uri: {
        description: 'URI to use to hijack upstream redirects',
        required: true,
      },
      authorization_endpoint: {
        description: 'URI to replace authorization endpoint metadata with',
        required: true,
      },
      token_endpoint: {
        description: 'URI to replace token endpoint metadata with',
        required: true,
      },
      upstream_issuer: {
        description: 'URI of upstream issuer to be proxies',
        required: true,
      },
      aws_secret: {
        description: "AWS Secret Access Key",
        required: true,
        default: 'NONE',
      },
      aws_id: {
        description: "AWS Access ID",
        required: true,
        default: 'NONE',
      },
      aws_region: {
        description: "AWS Region",
        required: true,
        default: 'us-west-2',
      },
      dynamo_local: {
        description: "flag to use local DynamoDB instance",
        required: false,
      }
    })
    .wrap(yargs.terminalWidth())
    .argv;
}

module.exports = {
  processArgs,
}

