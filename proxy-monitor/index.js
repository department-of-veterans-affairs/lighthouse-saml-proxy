const express = require('express');
const process = require('process');
const request = require('request-promise-native')
const { processArgs } = require('./cli')
require('log-timestamp');

const config = processArgs();
const { saml_proxy_endpoint, oauth_proxy_endpoint, port } = config;

function ping(uri) {
  return request({method: 'GET', uri: uri, resolveWithFullResponse: true})
      .then( response => {
        console.log(uri, response.statusCode)
        return 'ok';
      })
      .catch( err => {
        console.error(uri, err.message)
        return err.message;
      });
}

function startApp() {
  const app = express();

  app.get('/health-check', async (req, res) => {
    const saml = await ping(saml_proxy_endpoint);
    const oauth = await ping(oauth_proxy_endpoint);

    if (saml === 'ok' && oauth == 'ok') {
      res.status(200).json({saml, oauth});
    } else {
      res.status(500).json({saml, oauth});
    }
  });

  app.listen(port, () => console.log(`Proxy monitor listening on port ${port}!`));
  return app;
}

try {
  startApp();
} catch (error) {
  console.error(error);
  process.exit(1);
}

module.exports = {
  startApp,
}
