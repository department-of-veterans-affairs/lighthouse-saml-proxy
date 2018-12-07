import isString from "lodash.isstring";
import { resolveFilePath } from "./utils";

export function checkEncryptionCerts(argv, aliases) {
  if (argv.idpEncryptAssertion) {
    if (argv.idpEncryptionPublicKey === undefined) {
      return 'encryptionPublicKey argument is also required for assertion encryption';
    }
    if (argv.idpEncryptionCert === undefined) {
      return 'encryptionCert argument is also required for assertion encryption';
    }
  }
  return true;
}

export function checkIdpProfileMapper(argv, aliases) {
  if (argv.idpConfig) {
    return true;
  }
  const configFilePath = resolveFilePath(argv.idpConfigFile);

  if (!configFilePath) {
    return 'SAML attribute config file path "' + argv.idpConfigFile + '" is not a valid path.\n';
  }
  try {
    argv.idpConfig = require(configFilePath);
  } catch (error) {
    return 'Encountered an exception while loading SAML attribute config file "' + configFilePath + '".\n' + error;
  }
  return true;
}

export function checkWhenNoMetadata(argv, aliases) {
  if (!isString(argv.spIdpMetaUrl)) {
    if (!isString(argv.spIdpSsoUrl) || argv.spIdpSsoUrl === '') {
      return 'IdP SSO Assertion Consumer URL (spIdpSsoUrl) is required when IdP metadata is not specified';
    }
    if (!isString(argv.spIdpCert) && !isString(argv.spIdpThumbprint)) {
      return ' IdP Signing Certificate (spIdpCert) or IdP Signing Key Thumbprint (spIdpThumbprint) is required when IdP metadata is not specified';
    }
    // convert cert to PEM
    argv.spIdpCertPEM = certToPEM(argv.spIdpCert);
  }
  return true;
}
