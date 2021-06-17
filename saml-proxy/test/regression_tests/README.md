# lightouse-saml-proxy regression tests

## Quick Start

`cp .env.SAMPLE .env`

configure .env

`mkdir screenshots`

`npm test`

or

`npm test -- tests/saml-proxy.test.js`


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
