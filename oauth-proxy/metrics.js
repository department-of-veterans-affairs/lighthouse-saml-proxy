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

const refreshGauge = new client.Gauge({
  name: 'oauth_proxy_token_refresh_gauge',
  help: 'metric for timing of token_refresh flow'
});

const dynamodbGauge = new client.Gauge({
  name: 'oauth_proxy_dynamodb_gauge',
  help: 'metric for timing of dynamo_save flow'
});

const validationGauge = new client.Gauge({
  name: 'oauth_proxy_validation_gauge',
  help: 'metric for timing of validation flow'
});

module.exports = {
  loginBegin,
  loginEnd,
  refreshGauge,
  dynamodbGauge,
  validationGauge
}
