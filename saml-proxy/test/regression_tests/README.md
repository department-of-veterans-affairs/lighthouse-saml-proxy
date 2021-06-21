# lightouse-saml-proxy regression tests

## Quick Start

```sh
export SAML_PROXY_URL={ saml proxy url }
export IDP={ idp }
export CLIENT_ID={ client id }
export HEADLESS={ 0 (true) or 1 (false) } // note: this value only is important for local runs
```

**local**

```js
npm i
npm test
```

**docker**

```sh
docker build -f Dockerfile.test . -t vasdvp/lighthouse-saml-proxy-tests

docker run \
    --rm \
    --network="container:<container id>" \
    vasdvp/lighthouse-saml-proxy-tests \
    --saml-proxy-url=$SAML_PROXY_URL \
    --client-id=$CLIENT_ID \
    --idp=$IDP
```

**Note**: the newtwork option is only needed if you are running the test against a local saml proxy. Because our auth servers determine the saml-proxy url based on the idp, the docker version of the regression tests will only work against local instances of the saml proxy if they are running via docker. It is recommended to run the tests locally if possible.

## SAML Proxy Tests

Not all tests that should be preformed on the Saml-Proxy are covered in this repository. 

- Happy Path [x]
- Empy SSO call [x]
- MVI ICN error [ ] (Cannot find test user that fails MVI lookup, can be created with proper config changes)
- MVI Internal error [x]
- Invalid LOA [ ] (Cannot be implemented until proper test user is settup)
- Basic Saml Modify [x]
- Signature Wrapping Attacks 1 -8 [ ]
- Replay Attack [x]
- XXE Attack [ ]
- Comment Truncation Attack [ ]

## SAML PROXY ERRORS

## Internal Failure

These errors consists of failures within the VA system. They may be from the Saml Proxy or another system such as MVI.

### Contents

- VA Formatting
- VA Tools not working message
- Request ID
 
![internalFailure](https://user-images.githubusercontent.com/65039481/104048570-aa607f00-51a0-11eb-979c-66c769532b2a.png)

## Error

These are general errors. It is usually caused by invalid input. They display messages to help the user trouble shoot their issue.

### Contents

- VA Formatting
- Error Description
- Request ID

![error](https://user-images.githubusercontent.com/65039481/103314520-9e2a3400-49e0-11eb-992d-836d3339b4a4.png)


## Sensitive Error

These errors contain information that should not be exposed publicaly, such as information about an attack being prevented.

### Contents

- VA Formatting
- General Error Message
- Request ID

![sensitiveError](https://user-images.githubusercontent.com/65039481/104048640-ce23c500-51a0-11eb-931f-0e098e7cbc76.png)

## ICN

This error occurs when the VA cannot retrieve an ICN from its internal IDPs.

### Contents

- VA Formatting
- Matching error message
- Request ID

![matchingError](https://user-images.githubusercontent.com/65039481/103314553-b306c780-49e0-11eb-81f3-c4638b114aa2.png)

## Errors -> Templates

The following is a list of common errors and they template type that they are expected to render.

**Matching Error**

- ICN
- Internal Failure

**Invalid XML**

- Sensitive Error

**Modify SAML**

- Sensitive Error

**XSW Attacks**

- Sensitive Error

**Replay**

- Sensitive Error

**Empty Request**

- Sensitive Error

**Invalid Request**

- Sensitive Error

**404**

- Error
