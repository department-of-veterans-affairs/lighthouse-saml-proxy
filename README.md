# VA.gov SAML Proxy

This app provides a SAML SP and a SAML IdP that allows it to proxy SAML requests from Okta, which VA.gov will use as an OpenID Connect provider, and ID.me which VA.gov currently uses a authentication service. 

## Installation

Requires Docker and/or Node.js > 8.

### Config File

You'll need to create a configuration JSON file with at the least the following minimum fields:

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

`idpAcsUrl`, `idpIssuer`, `idpAudience`, and `idBaseUrl` are all configuration provided from id.me.

### Commands

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

## SAML Flow

Flow of the SAML login process: 

```
+-----------------------+
|                       |                                                                                               +-------------------------+
|  User clicks          |                                                                        +--------------+       |                         |
|  "Login with Va.gov"  |                                                                        |              |       | Id.me gets AuthNRequest |
|                       |                                                                        | User selects +-------> with AuthNContext of    +---------+
+---|-------------------+                                                                    +---> DSLogon      |       | 'dslogon'               |         |
    |                                                                                        |   |              |       |                         |         |
    |                                                                                        |   +--------------+       +-------------------------+         |
    |                                                                                        |                                                              |
+---v---------------+     +-------------------------------+     +-------------------------+  |   +--------------+       +-------------------------+     +---v----------+
|                   |     |                               |     |                         +--+   |              |       |                         |     |              |
|  GET /authorize   |     |  POST /sso                    |     |  User is presented      |      | User selects +-------> Id.me gets AuthNRequest |     | User logs in +--+
|  Okta starts SAML +----->  Proxy receives AuthNRequest  +----->  with DSLogon, Id.me, & +------> MHV          |       | with AuthNContext of    +----->              |  |
|  IdP flow         |     |  From Okta                    |     |  MHV login options      |      |              |       | 'mhv'                   |     +----^---------+  |
|                   |     |                               |     |                         +--+   +--------------+       |                         |          |            |
+-------------------+     +-------------------------------+     +-------------------------+  |                          +-------------------------+          |            |
                                                                                             |   +--------------+                                            |            |
                                                                                             |   |              |       +-------------------------+          |            |
                                                                                             |   | User selects |       |                         |          |            |
                                                                                             +---> Id.me        +-------> Id.me gets AuthNRequest |          |            |
                                                                                                 |              |       | with AuthNContext of    +----------+            |
                                                                                                 +--------------+       | 'loa3'                  |                       |
                                                                                                                        |                         |                       |
                                                                                                                        +-------------------------+                       |
                                                                                                                                                                          |
                                         +--------------------------------------------------------------------------------------------------------------------------------+
                                         |
                                         |
                                         |
                           +-------------v-----------------+    +---------------------------+
                           |                               |    |                           |
                           | GET /sso                      |    |  Proxy POSTS SAMLResponse |
                           | Proxy receives redirect from  +---->  To Okta                  |
                           | Id.me with SAMLResponse       |    |                           |
                           |                               |    +---------------------------+
                           +-------------------------------+
```

## Contributing

This is a hybrid JavaScript/Typescript application. Our goal is eventually have it be completely written in Typescript, therefor all new features should be written in TypeScript and have accompanying test written using Jest. 
