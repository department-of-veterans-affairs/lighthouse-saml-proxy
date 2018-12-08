const yargs = require('yargs');

function processArgs() {
  return yargs
    .usage('SAML/OAuth Proxy Monitor')
    .config()
    .options({
      saml_proxy_endpoint: {
        description: 'SAML Proxy monitor endpoint',
        required: true,
      },
      oauth_proxy_endpoint: {
        description: 'OAuth Proxy monitor endpoint',
        required: true,
      },
      port: {
        description: 'Port for Proxy to list',
        required: true,
        default: 7200,
      },
    })
    .wrap(yargs.terminalWidth())
    .argv;
}

module.exports = {
  processArgs,
}

