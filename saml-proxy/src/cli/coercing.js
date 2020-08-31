import fs from "fs";
import { resolveFilePath } from "./utils";

const cryptTypes = {
  certificate: /-----BEGIN CERTIFICATE-----[^-]*-----END CERTIFICATE-----/,
  "private key": /-----BEGIN (RSA )?PRIVATE KEY-----\n[^-]*\n-----END (RSA )?PRIVATE KEY-----/,
  "public key": /-----BEGIN PUBLIC KEY-----\n[^-]*\n-----END PUBLIC KEY-----/,
};

export const KEY_CERT_HELP_TEXT = `Please generate a key-pair for the IdP using the following openssl command:
\topenssl req -x509 -new -newkey rsa:2048 -nodes -subj '/C=US/ST=California/L=San Francisco/O=JankyCo/CN=Test Identity Provider' -keyout idp-private-key.pem -out idp-public-cert.pem -days 7300`;

export function matchesCertType(value, type) {
  return cryptTypes[type] && cryptTypes[type].test(value);
}

function bufferFromString(value) {
  if (Buffer.hasOwnProperty("from")) {
    // node 6+
    return Buffer.from(value);
  } else {
    return new Buffer(value);
  }
}

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

export function certToPEM(cert) {
  if (/-----BEGIN CERTIFICATE-----/.test(cert)) {
    return cert;
  }

  cert = cert.match(/.{1,64}/g).join("\n");
  cert = "-----BEGIN CERTIFICATE-----\n" + cert;
  cert = cert + "\n-----END CERTIFICATE-----\n";
  return cert;
}

function loadFileSync(value) {
  const filePath = resolveFilePath(value);
  if (filePath) {
    return fs.readFileSync(filePath, "utf8");
  }
  return "";
}
