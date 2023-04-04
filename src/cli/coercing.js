import fs from "fs";
import { resolveFilePath } from "./utils";

const cryptTypes = {
  certificate: /-----BEGIN CERTIFICATE-----[^-]*-----END CERTIFICATE-----/,
  "private key": /-----BEGIN (RSA )?PRIVATE KEY-----\n[^-]*\n-----END (RSA )?PRIVATE KEY-----/,
  "public key": /-----BEGIN PUBLIC KEY-----\n[^-]*\n-----END PUBLIC KEY-----/,
};

export const KEY_CERT_HELP_TEXT = `Please generate a key-pair for the IdP using the following openssl command:
\topenssl req -x509 -new -newkey rsa:2048 -nodes -subj '/C=US/ST=California/L=San Francisco/O=JankyCo/CN=Test Identity Provider' -keyout idp-private-key.pem -out idp-public-cert.pem -days 7300`;

/**
 * This function matches the cert type and returns crypt types
 *
 * @param {*} value test value
 * @param {*} type crypt type
 * @returns {*} cryptTypes
 */
export function matchesCertType(value, type) {
  return cryptTypes[type] && cryptTypes[type].test(value);
}
/**
 * Creates a buffer from string using checks to see if buffer
 * has own property then returns the buffer value
 *
 * @param {*} value param for holding buffer value
 * @returns {Buffer} returns either a new buffer value or existing value
 */
export function bufferFromString(value) {
  if (Buffer.hasOwnProperty("from")) {
    // node 6+
    return Buffer.from(value);
  } else {
    return new Buffer(value);
  }
}
/**
 * This function makes a certificate file coercer based on the cert type
 * and returns a filepath or cert type value based off of the check.
 *
 * @param {*} type the type of the file
 * @param {*} description the file description
 * @param {*} helpText the help text contained within the file
 * @returns {*} returns a filepath that is read in or a cert type value
 */
export function makeCertFileCoercer(type, description, helpText) {
  return function certFileCoercer(value) {
    if (matchesCertType(value, type)) {
      return value;
    }

    const filePath = resolveFilePath(value);
    if (filePath) {
      return fs.readFileSync(filePath);
    }
    throw new Error(
      `Invalid ${description}, not a valid crypt cert/key or file path ${
        helpText ? "\n" + helpText : ""
      }`
    );
  };
}

/**
 * Creates the certificate to PEM
 *
 * @param {*} cert the param for a certificate
 * @returns {cert} returns the certificate to PEM with BEGIN and END messages
 */
export function certToPEM(cert) {
  if (/-----BEGIN CERTIFICATE-----/.test(cert)) {
    return cert;
  }

  cert = cert.match(/.{1,64}/g).join("\n");
  cert = "-----BEGIN CERTIFICATE-----\n" + cert;
  cert = cert + "\n-----END CERTIFICATE-----\n";
  return cert;
}

/**
 * Creates the check for load file sync using the filepath and value of the file
 *
 * @param {*} value the value of the file
 * @returns {*} returns empty string or reads in the file and returns filepath
 */
export function loadFileSync(value) {
  const filePath = resolveFilePath(value);
  if (filePath) {
    return fs.readFileSync(filePath, "utf8");
  }
  return "";
}
