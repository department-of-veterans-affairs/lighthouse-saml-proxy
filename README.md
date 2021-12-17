# VA Lighthouse SAML Proxy

This app provides a SAML SP and a SAML IdP that allows it to proxy SAML requests from Okta, which VA.gov will use as an OpenID Connect provider, and external IdP's, such as ID.me and Login.gov which VA.gov currently uses for authentication services. 

## Installation

Requires Docker and/or Node.js > 16.

### Config File

You'll need to create a configuration JSON file with at the least the following minimum fields.

dev-config.json

```json
{
  "idpAcsUrl": "https://idp.example.com/acs/url",
  "idpIssuer": "idp-issuer.example.com",
  "idpAudience": "https://idp.example.com/audience",
  "idpBaseUrl": "https://idp.example.com/base/url",
  "spIdpMetaUrl": "https://sp.example.com/idp/meta/url",
  "spNameIDFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  "spAudience": "sp-audience.example.com",
  "spIdpIssuer": "sp-idp-issuer.example.com",
  "spAuthnContextClassRef": "http://sp.example.com/authn/context/class/ref",
  "spAcsUrl": "/samlproxy/sp/saml/sso",
  "idpCert": "./idp-public-cert.pem",
  "idpKey": "./idp-private-key.pem",
  "spCert": "./sp-cert.pem",
  "spKey": "./sp-key.pem",
  "idpEncryptAssertion": true,
  "idpEncryptionCert": "./idp-encryption-cert.pem",
  "idpEncryptionPublicKey": "./idp-encryption-pub.key",
  "vetsAPIHost": "https://vets-api.example.com",
  "vetsAPIToken": "vets-api-token",
  "sessionSecret": "fake-session-secret",
  "cacheEnabled": true,
  "redisPort": "6379",
  "redisHost": "127.0.0.1",
  "spIdpSsoBinding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
  "idpSelectionRefactor" : true,
  "idpSamlLoginsEnabled": true,
  "idpSamlLogins": 
  [
    {
      "category": "example2SamlIdp",
      "spIdpMetaUrl": "https://saml-idp.example2.com/metadata",
      "spNameIDFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      "spAudience": "https://saml-idp.example2.com",
      "spAuthnContextClassRef": "http://sp.example2.com/authn/context/class/ref",
      "spRequestAuthnContext": true,
      "spRequestNameIDFormat": true,
      "spIdpSignupLinkEnabled": true
   }
  ]
```

`idpAcsUrl`, `idpIssuer`, `idpAudience`, and `idBaseUrl` are all configuration provided from id.me.

A functional dev-config file can be found in the [saml-proxy-configs](https://github.com/department-of-veterans-affairs/lighthouse-saml-proxy-configs) repository. Fields with the `FIX_ME` value must be replaced with real values.

### Commands

Docker: 

Stop redis, if it is running locally. Make sure the following config value is set: `redisHost: redis`.

```bash
docker build -t saml-idp .
docker run -p 7000:7000 saml-idp --config dev-config.json
```

Node:

Redis must be running locally.

Make sure the following config value is set properly: `redisHost: 127.0.0.1`.

```bash
npm install
npm run-script start-dev
```

### Using LoginGov with Local Saml-Proxy

Login.Gov does not support http ACS endpoints. Run the following command to set up an https proxy for the saml-proxy.

```sh
npm install -g local-ssl-proxy
local-ssl-proxy --source 9001 --target 7000
```

### Generating IdP Signing Certificate

**This key will not work with ID.me without further configuration.**

You must generate a self-signed certificate for the IdP.

> The private key should be unique to your test IdP and not shared!

You can generate a keypair using the following command (requires openssl in your path):

``` shell
openssl req -x509 -new -newkey rsa:2048 -nodes -subj '/C=US/ST=California/L=San Francisco/O=JankyCo/CN=Test Identity Provider' -keyout idp-private-key.pem -out idp-public-cert.pem -days 7300
```

You will also need to generated a self-signed certificate of the SP functions

``` shell
openssl req -x509 -new -newkey rsa:2048 -nodes -subj '/C=US/ST=California/L=San Francisco/O=JankyCo/CN=Test Identity Provider' -keyout sp-key.pem -out sp-cert.pem -days 7300
```

You can also grab the development certificates from [here](https://github.com/department-of-veterans-affairs/vets-contrib/blob/master/Developer%20Process/SAML%20Proxy/Certificates.md).

### How to setup Sentry Locally

There are cases where a developer may want to confirm that sentry error reporting is working.

Clone sentry/onpremise from github

```sh
git clone https://github.com/getsentry/onpremise.git
```

In the onpremise repository run the following command and follow its prompts:

```sh
./initialize.sh
```

After initialization build project

```sh
docker-compose up -d
```

you can log into your local sentry instance at `http://127.0.0.1:9000/`.

Set the following variables in your local config:

```json
"sentryDSN": "http://d89d94561646443ab59ff3f262cbb3bc@127.0.0.1:9000/1",
"sentryEnvironment": "TEST"
```

To create an error run one of the following cases:

1. Intercept a SAMLRequest and malform the xml.
2. Intercept a SAMLResponse and malform the xml.

## SAML Flow

The proxy fills both roles typically seen in a SAML interaction:
- It acts as an Identity Provider (IDP) relative to Okta. It receives a SAML request from Okta, and returns a SAML response.
- It acts as a Service Provider (SP) relative to selected IDP services eg. Login.gov and ID.me. It sends a SAML request to the user-selected IDP, and receives a SAML response. 

These two interactions are interleaved,
- the request received from Okta is re-signed and passed along to the coresponding IDP service. Then the respone from the IDP service is validated, transformed, re-signed, and passed along to Okta. 

Flow of the SAML login process: 

```
+-----------------------+
|                       |
|  User clicks          |
|  "Login with Va.gov"  |
|                       |
+---|-------------------+
    |
    |
    |
+---v---------------+     +-------------------------------+     +-------------------------+
|                   |     |                               |     |                         |
|  GET /authorize   |     |  POST /samlproxy/idp/saml/sso |     |  User is presented      |
|  Okta starts SAML +----->  Proxy receives AuthNRequest  +-----+  with a list of IDP     |
|                   |     |                               |     |  login options          |
+-------------------+     +-------------------------------+     |                         |
                                                                +----|--------------------+
                                                                     | 
         +-----------------------------------------------------------+ 
         | 
         |
         | 
   +-----v----------+
   |                |
   | User selects   |
   | one of the IDP |
   | options        |
   |                |
   +-----|----------+
         |
         | 
+--------v-------------------+
|                            |
| The IDP service gets the   | 
| AuthNRequest with the      |
| corresponding AuthNContext |
|                            |
+--|-------------------------+
   |
   |
   |
   |
   |
   |                 +-------------------------------+    +---------------------------+
 +-v------------+    |                               |    |                           |
 |              |    | GET /samlproxy/sp/saml/sso    |    |  Proxy POSTS SAMLResponse |
 | User logs in +----> Proxy receives redirect from  +---->  To Okta                  |
 |              |    | the IDP service with the      |    |                           |
 +--------------+    | SAMLResponse                  |    +---------------------------+
                     |                               |
                     +-------------------------------+

```

## Contributing

This is a hybrid JavaScript/Typescript application. Our goal is eventually have it be completely written in Typescript, therefore all new features should be written in TypeScript and have accompanying test written using Jest. 
