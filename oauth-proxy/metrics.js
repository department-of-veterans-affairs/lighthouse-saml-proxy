const client = require('prom-client');

const defaultLabels = { app: 'oauth_proxy' };
client.register.setDefaultLabels(defaultLabels);

const loginBegin = new client.Counter({
  name: 'oauth_proxy_login_begin',
  help: 'counter of number of times the OAuth login process has begun',
});

const loginEnd = new client.Counter({
  name: 'oauth_proxy_login_end',
  help: 'counter of number of times the OAuth login process has ended',
});

const tokenHandlerGauge = new client.Gauge({
  name: 'oauth_proxy_token_handler_gauge',
  help: 'metric for timing of token_handler flow'
});

module.exports = {
  loginBegin,
  loginEnd,
  tokenHandlerGauge
}
