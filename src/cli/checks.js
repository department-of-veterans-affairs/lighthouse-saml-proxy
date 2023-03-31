import isString from "lodash.isstring";
import { certToPEM } from "./coercing";
/**
 * Creates the check for encryption certs
 *
 * @param {*} argv argument vector
 * @returns {boolean} returns a boolean if encryption certs are defined
 */
export function checkEncryptionCerts(argv) {
  if (argv.idpEncryptAssertion) {
    if (argv.idpEncryptionPublicKey === undefined) {
      return "encryptionPublicKey argument is also required for assertion encryption";
    }
    if (argv.idpEncryptionCert === undefined) {
      return "encryptionCert argument is also required for assertion encryption";
    }
  }
  return true;
}

/**
 * Creates the check for metadata
 *
 * @param {*} argv argument vector
 * @returns {boolean} returns a true when metadata is present
 */
export function checkWhenNoMetadata(argv) {
  if (!isString(argv.spIdpMetaUrl)) {
    if (!isString(argv.spIdpSsoUrl) || argv.spIdpSsoUrl === "") {
      return "IdP SSO Assertion Consumer URL (spIdpSsoUrl) is required when IdP metadata is not specified";
    }
    if (!isString(argv.spIdpCert) && !isString(argv.spIdpThumbprint)) {
      return " IdP Signing Certificate (spIdpCert) or IdP Signing Key Thumbprint (spIdpThumbprint) is required when IdP metadata is not specified";
    }
    // convert cert to PEM
    argv.spIdpCertPEM = certToPEM(argv.spIdpCert);
  }
  return true;
}
