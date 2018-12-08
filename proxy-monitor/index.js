const express = require('express');
const process = require('process');
const request = require('request-promise-native')
const { processArgs } = require('./cli')
require('log-timestamp');

const config = processArgs();
const { saml_proxy_endpoint, oauth_proxy_endpoint, port } = config;

function ping(uri) {
  return request({method: 'GET', uri: uri, resolveWithFullResponse: true})
      .then( (response) => {
        console.log(uri, response.statusCode)
        return 'ok';
      })
      .catch( (err) => {
        console.log(uri, err.message)
        return err.message;
      });
} 

function startApp() {
  const app = express();

  app.get('/health-check', async (req, res) => {
    const samlPromise = ping(saml_proxy_endpoint);
    const oauthPromise = ping(oauth_proxy_endpoint);
    const samlStatus = await samlPromise;
    const oauthStatus = await oauthPromise;

    if (samlStatus === 'ok' && oauthStatus == 'ok') {
      res.status(200).send(JSON.stringify({'saml': samlStatus, 'oauth': oauthStatus}))
    } else {
      res.status(500).send(JSON.stringify({'saml': samlStatus, 'oauth': oauthStatus}))
    }
  });

  app.listen(port, () => console.log(`Proxy monitor listening on port ${port}!`));
  return app;
}

(async () => {
  try {
    startApp();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();

module.exports = {
  startApp,
}
