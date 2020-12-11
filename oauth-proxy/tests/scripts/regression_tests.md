# Oauth Proxy Regression Tests

## Quick Start

```
export USER_EMAIL=va.api.user+idme.001@gmail.com
export USER_PASSWORD=Password1234!
export CLIENT_ID={{ client id }}
export CLIENT_SECRET={{ client secret }}
export HOST=https://sandbox-api.va.gov/oauth2
export CC_CLIENT_ID={{ client id }}
export CC_CLIENT_SECRET={{ client secret }}
```

```
./regression_tests.sh
```

*Note* 

- The test CLIENT_ID must be whitespaced for https://app/after-auth as a Redirect URL.