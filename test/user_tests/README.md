# lighthouse-saml-proxy user tests
These will cycle though a set of test users that are expected to have successful logins

## Quick Start

```sh
export IDP={ idp }
export CLIENT_ID={ client id }
export USER_PASSWORD={ user password }
export AUTHORIZATION_URL={ ex. https://sandbox-api.va.gov/oauth2 }
export HEADLESS={ 0 (false) or 1 (true) } // note: this value only is important for local runs
```

**local**

```js
npm i
npm test
```

**Note**: the network option is only needed if you are running the test against a local saml proxy. Because our auth servers determine the saml-proxy url based on the idp, the docker version of the regression tests will only work against local instances of the saml proxy if they are running via docker. It is recommended to run the tests locally if possible.

## SAML Proxy User Tests
Example results

```
    ✓ Login with va.api.user+idme.001@gmail.com (17401 ms)
    ✓ Login with va.api.user+idme.003@gmail.com (21133 ms)
    ✓ Login with va.api.user+idme.101@gmail.com (17361 ms)
    ✓ Login with va.api.user+idme.102@gmail.com (17175 ms)
    ✓ Login with va.api.user+idme.103@gmail.com (15127 ms)
```


