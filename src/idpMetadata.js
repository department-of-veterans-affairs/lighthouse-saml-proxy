"use strict";

const fs = require("fs");
const xml2js = require("xml2js");
const logger = require("./logger");

/**
 * Creates a check to receive the binding location
 * using serviceEl and the bindingUri
 *
 * @param {*} serviceEl serviceEl
 * @param {*} bindingUri specifies information to communicate with location
 * @returns {*} returns the binding location if the element matches the bindingUri
 */
function getBindingLocation(serviceEl, bindingUri) {
  var location;
  if (serviceEl && serviceEl.length > 0) {
    serviceEl.forEach((element) => {
      if (element.$.Binding.toLowerCase() === bindingUri) {
        location = element.$.Location;
      }
    });
  }
  return location;
}

/**
 * Creates a check to get the first cert using
 * key info data.
 *
 * @param {*} keyEl encryption key
 * @returns {keyEl}  returns the first cert using keyInfo
 */
function getFirstCert(keyEl) {
  if (
    keyEl.KeyInfo &&
    keyEl.KeyInfo.length === 1 &&
    keyEl.KeyInfo[0].X509Data &&
    keyEl.KeyInfo[0].X509Data.length === 1 &&
    keyEl.KeyInfo[0].X509Data[0].X509Certificate &&
    keyEl.KeyInfo[0].X509Data[0].X509Certificate.length === 1
  ) {
    return keyEl.KeyInfo[0].X509Data[0].X509Certificate[0]._;
  }
  return null;
}

/**
 * Function to read and parse XML file
 *
 * @param {string} filePath Path to the XML file
 * @returns {Promise<object>} Parsed XML object
 */
function parseXML(filePath) {
  const parserConfig = {
    explicitRoot: true,
    explicitCharkey: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  };
  const parser = new xml2js.Parser(parserConfig);

  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        return reject(err);
      }

      parser.parseString(data, (err, result) => {
        if (err) {
          return reject(err);
        }
        resolve(result);
      });
    });
  });
}

/**
 * Creates the check for fetching metadata by reading from a file,
 * parsing the config parameters, getting the binding location and
 * parsing the RoleDescriptor metadata
 *
 * @param {string} filePath Path to the metadata file
 * @returns {Promise<object>} returns the RoleDescriptor metadata with parameters sso, slo, nameIdFormat and signingKeys
 */
export function fetch(filePath) {
  return new Promise((resolve, reject) => {
    const metadata = { sso: {}, slo: {}, nameIdFormats: [], signingKeys: [] };

    if (typeof filePath === "undefined" || filePath === null) {
      return resolve(metadata);
    }

    parseXML(filePath)
      .then((docEl) => {
        if (docEl.EntityDescriptor) {
          metadata.issuer = docEl.EntityDescriptor.$.entityID;

          if (
            docEl.EntityDescriptor.IDPSSODescriptor &&
            docEl.EntityDescriptor.IDPSSODescriptor.length === 1
          ) {
            metadata.protocol = "samlp";
            let ssoEl = docEl.EntityDescriptor.IDPSSODescriptor;
            metadata.signRequest =
              docEl.EntityDescriptor.IDPSSODescriptor[0].$.WantAuthnRequestsSigned;

            ssoEl[0].KeyDescriptor.forEach((keyEl) => {
              if (keyEl.$.use && keyEl.$.use.toLowerCase() !== "encryption") {
                const signingKey = {};
                signingKey.cert = getFirstCert(keyEl);
                if (keyEl.$.active && keyEl.$.active === "true") {
                  signingKey.active = true;
                }
                metadata.signingKeys.push(signingKey);
              }
            });

            if (ssoEl[0].NameIDFormat) {
              ssoEl[0].NameIDFormat.forEach((element) => {
                if (element._) {
                  metadata.nameIdFormats.push(element._);
                }
              });
            }

            metadata.sso.redirectUrl = getBindingLocation(
              ssoEl[0].SingleSignOnService,
              "urn:oasis:names:tc:saml:2.0:bindings:http-redirect"
            );
            metadata.sso.postUrl = getBindingLocation(
              ssoEl[0].SingleSignOnService,
              "urn:oasis:names:tc:saml:2.0:bindings:http-post"
            );

            metadata.slo.redirectUrl = getBindingLocation(
              ssoEl[0].SingleLogoutService,
              "urn:oasis:names:tc:saml:2.0:bindings:http-redirect"
            );
            metadata.slo.postUrl = getBindingLocation(
              ssoEl[0].SingleLogoutService,
              "urn:oasis:names:tc:saml:2.0:bindings:http-post"
            );
          }
        }

        if (docEl.EntityDescriptor.RoleDescriptor) {
          metadata.protocol = "wsfed";
          try {
            let roleEl = docEl.EntityDescriptor.RoleDescriptor.find((el) => {
              return el.$["xsi:type"].endsWith(":SecurityTokenServiceType");
            });
            metadata.sso.redirectUrl =
              roleEl.PassiveRequestorEndpoint[0].EndpointReference[0].Address[0]._;

            roleEl.KeyDescriptor.forEach((keyEl) => {
              metadata.signingKeys.push(getFirstCert(keyEl));
            });
          } catch (e) {
            logger.error("Unable to parse RoleDescriptor metadata", e);
          }
        }
        return resolve(metadata);
      })
      .catch((err) => {
        logger.error("Error reading/parsing XML file:", err);
        reject(err);
      });
  });
}
