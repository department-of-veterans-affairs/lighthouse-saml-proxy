"use strict";

const xml2js = require("xml2js");
const logger = require("./logger");
const axios = require("axios");
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
 * Creates the check for fetching url by requesting the url,
 * parsing the config parameters, getting the binding location and
 * parsing the RoleDescriptor metadata
 *
 * @param {*} url fetch url
 * @returns {*} returns the RoleDescriptor metadata with parameters sso, slo, nameIdFormat and signingKeys
 */
export function fetch(url) {
  return new Promise((resolve, reject) => {
    const metadata = { sso: {}, slo: {}, nameIdFormats: [], signingKeys: [] };

    if (typeof url === "undefined" || url === null) {
      return resolve(metadata);
    }

    axios
      .get(url)
      .then((response) => {
        const responseData = response.data;
        {
          const parserConfig = {
              explicitRoot: true,
              explicitCharkey: true,
              tagNameProcessors: [xml2js.processors.stripPrefix],
            },
            parser = new xml2js.Parser(parserConfig);

          parser.parseString(responseData, (err, docEl) => {
            if (err) {
              return reject(err);
            }

            if (docEl.EntityDescriptor) {
              metadata.issuer = docEl.EntityDescriptor.$.entityID;

              if (
                docEl.EntityDescriptor.IDPSSODescriptor &&
                docEl.EntityDescriptor.IDPSSODescriptor.length === 1
              ) {
                metadata.protocol = "samlp";
                let ssoEl = docEl.EntityDescriptor.IDPSSODescriptor[0];
                metadata.signRequest = ssoEl.$.WantAuthnRequestsSigned;

                ssoEl.KeyDescriptor.forEach((keyEl) => {
                  if (
                    keyEl.$.use &&
                    keyEl.$.use.toLowerCase() !== "encryption"
                  ) {
                    const signingKey = {};
                    signingKey.cert = getFirstCert(keyEl);
                    if (keyEl.$.active && keyEl.$.active === "true") {
                      signingKey.active = true;
                    }
                    metadata.signingKeys.push(signingKey);
                  }
                });

                if (ssoEl.NameIDFormat) {
                  ssoEl.NameIDFormat.forEach((element) => {
                    if (element._) {
                      metadata.nameIdFormats.push(element._);
                    }
                  });
                }

                metadata.sso.redirectUrl = getBindingLocation(
                  ssoEl.SingleSignOnService,
                  "urn:oasis:names:tc:saml:2.0:bindings:http-redirect"
                );
                metadata.sso.postUrl = getBindingLocation(
                  ssoEl.SingleSignOnService,
                  "urn:oasis:names:tc:saml:2.0:bindings:http-post"
                );

                metadata.slo.redirectUrl = getBindingLocation(
                  ssoEl.SingleLogoutService,
                  "urn:oasis:names:tc:saml:2.0:bindings:http-redirect"
                );
                metadata.slo.postUrl = getBindingLocation(
                  ssoEl.SingleLogoutService,
                  "urn:oasis:names:tc:saml:2.0:bindings:http-post"
                );
              }
            }

            if (docEl.EntityDescriptor.RoleDescriptor) {
              metadata.protocol = "wsfed";
              try {
                let roleEl = docEl.EntityDescriptor.RoleDescriptor.find(
                  (el) => {
                    return el.$["xsi:type"].endsWith(
                      ":SecurityTokenServiceType"
                    );
                  }
                );
                metadata.sso.redirectUrl =
                  roleEl.PassiveRequestorEndpoint[0].EndpointReference[0].Address[0]._;

                roleEl.KeyDescriptor.forEach((keyEl) => {
                  metadata.signingKeys.push(getFirstCert(keyEl));
                });
              } catch (e) {
                logger.error("unable to parse RoleDescriptor metadata", e);
              }
            }
            return resolve(metadata);
          });
        }
      })
      .catch(() => {
        logger.error("Error receiving metadata");
      });
  });
}
