import express from "express";

import { certToPEM } from "../src/cli/coercing";
import IDPConfig from "../src/IDPConfig";
import configureExpress from "../src/routes";
import { TestCache } from "../src/routes/types";
import SPConfig from "../src/SPConfig";
import createPassportStrategy from "../src/routes/passport";

import { idpCert, idpKey, spCert, spKey } from "./testCerts";
import passport from "passport";

const defaultTestingConfig = {
  idpAcsUrl: "https://localhost:1111/samlproxy/sp/saml/sso",
  idpIssuer: "samlproxy-idp.vetsgov.dev",
  idpAudience: "test",
  idpBaseUrl: "https://dev-api.va.gov/samlproxy/idp",
  spAcsUrl: "/samlproxy/sp/saml/sso",
  idpCert: idpCert,
  idpKey: Buffer.from(idpKey, "utf-8"),
  spCert: Buffer.from(spCert, "utf-8"),
  spKey: Buffer.from(spKey, "utf-8"),
  spIdpCert: certToPEM(idpCert),
  sessionSecret: "fake-session-secret",
  spSignatureAlgorithm: "rsa-sha256",
  spDigestAlgorithm: "sha256",
  spRequestNameIDFormat: true,
  spValidateNameIDFormat: true,
  spNameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  spRequestAuthnContext: true,
  idpSamlLogins: [
    {
      category: "id_me",
      spIdpMetaUrl: "https://api.idmelabs.com/saml/metadata/provider",
      spNameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      spIdpSsoUrl: "https://api.idmelabs.com/saml/SingleSignOnService",
      spAudience: "test",
      spSignAuthnRequests: true,
      spIdpIssuer: "api.idmelabs.com",
      spAuthnContextClassRef: "http://idmanagement.gov/ns/assurance/loa/3",
      spRequestAuthnContext: true,
      spRequestNameIDFormat: true,
      spCert: Buffer.from(spCert, "utf-8"),
      spKey: Buffer.from(spKey, "utf-8"),
      spIdpCert: certToPEM(idpCert),
      spProtocol: "samlp",
      spIdpSignupOp: "&op=signup",
    },
    {
      category: "dslogon",
      spIdpMetaUrl: "https://api.idmelabs.com/saml/metadata/provider",
      spNameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      spIdpSsoUrl: "https://api.idmelabs.com/saml/SingleSignOnService",
      spAudience: "test",
      spSignAuthnRequests: true,
      spIdpIssuer: "api.idmelabs.com",
      spAuthnContextClassRef: "dslogon",
      spRequestAuthnContext: true,
      spRequestNameIDFormat: true,
      spCert: Buffer.from(spCert, "utf-8"),
      spKey: Buffer.from(spKey, "utf-8"),
      spIdpCert: certToPEM(idpCert),
      spProtocol: "samlp",
    },
    {
      category: "mhv",
      spIdpMetaUrl: "https://api.idmelabs.com/saml/metadata/provider",
      spNameIDFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
      spIdpSsoUrl: "https://api.idmelabs.com/saml/SingleSignOnService",
      spAudience: "test",
      spSignAuthnRequests: true,
      spIdpIssuer: "api.idmelabs.com",
      spAuthnContextClassRef: "myhealthevet",
      spRequestAuthnContext: true,
      spRequestNameIDFormat: true,
      spCert: Buffer.from(spCert, "utf-8"),
      spKey: Buffer.from(spKey, "utf-8"),
      spIdpCert: certToPEM(idpCert),
      spProtocol: "samlp",
    },
  ],
};

export const idpConfig = new IDPConfig(defaultTestingConfig);

export function getTestExpressApp(vetsApiClient, cache = new TestCache()) {
  const app = express();
  const spConfigs = {};
  const strategies = new Map();
  defaultTestingConfig.idpSamlLogins.forEach((spIdpConfig) => {
    spConfigs[spIdpConfig.category] = new SPConfig(spIdpConfig);
    strategies.set(
      spIdpConfig.category,
      createPassportStrategy(spConfigs[spIdpConfig.category])
    );
  });
  app.use(passport.initialize());
  configureExpress(
    app,
    defaultTestingConfig,
    idpConfig,
    spConfigs,
    strategies,
    vetsApiClient,
    cache
  );
  return app;
}
