# VA.gov SAML Proxy

This app provides a SAML SP and a SAML IdP that allows it to proxy SAML requests from Okta, which VA.gov will use as an OpenID Connect provider, and ID.me which VA.gov currently uses a authentication service. 

## Installation

Requires Docker and/or Node.js > 8.

You'll need to create a configuration JSON file with at the least the following minimum fields (non-sensitive fields kj:

dev-config.json
```json
{
  "idpAcsUrl": "",
  "idpIssuer": "",
  "idpAudience": "",
  "idpBaseUrl": "",
  "spIdpMetaUrl": "https://api.idmelabs.com/saml/metadata/provider",
  "spNameIDFormat": "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  "spAudience": "",
  "spIdpIssuer": "api.idmelabs.com",
  "spAuthnContextClassRef": "",
  "spAcsUrls": "/samlproxy/sp/saml/sso"
}
```

Docker: 
```bash
docker build -t saml-idp .
docker run -p 7000:7000 saml-idp --config dev-config.json
```

Node:
```bash
npm install
npm run-script start-dev
```

## Generating IdP Signing Certificate

**This key will not work with ID.me without further configuration.**

You must generate a self-signed certificate for the IdP.

> The private key should be unique to your test IdP and not shared!

You can generate a keypair using the following command (requires openssl in your path):

``` shell
openssl req -x509 -new -newkey rsa:2048 -nodes -subj '/C=US/ST=California/L=San Francisco/O=JankyCo/CN=Test Identity Provider' -keyout idp-private-key.pem -out idp-public-cert.pem -days 7300
```
