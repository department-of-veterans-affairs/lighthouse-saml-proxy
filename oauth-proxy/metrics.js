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

module.exports = {
  loginBegin,
  loginEnd,
}
