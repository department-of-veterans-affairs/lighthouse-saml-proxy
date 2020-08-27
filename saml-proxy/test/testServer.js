import express from "express";

import { certToPEM } from "../src/cli/coercing";
import IDPConfig from "../src/IDPConfig";
import configureExpress from "../src/routes";
import SPConfig from "../src/SPConfig";
import { removeHeaders } from "../src/utils";

import { idpCert, idpKey, spCert, spKey } from "./testCerts";

const defaultTestingConfig = {
  idpAcsUrl: "https://localhost:1111/samlproxy/sp/saml/sso",
  idpIssuer: "samlproxy-idp.vetsgov.dev",
  idpAudience: "test",
  idpBaseUrl: "https://dev-api.va.gov/samlproxy/idp",
  spIdpMetaUrl: "https://api.idmelabs.com/saml/metadata/provider",
  spIdpSsoBinding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
  spNameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  spProtocol: "samlp",
  spIdpSsoUrl: "https://api.idmelabs.com/saml/SingleSignOnService",
  spAudience: "test",
  spSignAuthnRequests: true,
  spIdpIssuer: "api.idmelabs.com",
  spAuthnContextClassRef: "http://idmanagement.gov/ns/assurance/loa/3",
  spAcsUrls: ["/samlproxy/sp/saml/sso"],
  idpCert: removeHeaders(idpCert),
  idpKey: Buffer.from(idpKey, "utf-8"),
  spCert: Buffer.from(spCert, "utf-8"),
  spKey: Buffer.from(spKey, "utf-8"),
  spIdpCert: certToPEM(idpCert),
  sessionSecret: "test",
  spSignatureAlgorithm: "rsa-sha256",
  spDigestAlgorithm: "sha256",
  spRequestNameIDFormat: true,
  spValidateNameIDFormat: true,
  spNameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  spRequestAuthnContext: true,
  spAuthnContextClassRef:
    "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport",
};

export const idpConfig = new IDPConfig(defaultTestingConfig);

export function getTestExpressApp(vetsApiClient) {
  const app = express();
  const spConfig = new SPConfig(defaultTestingConfig);
  configureExpress(
    app,
    defaultTestingConfig,
    idpConfig,
    spConfig,
    vetsApiClient
  );
  return app;
}
