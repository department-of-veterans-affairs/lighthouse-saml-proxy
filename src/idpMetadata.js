"use strict";

const request = require("request");
const xml2js = require("xml2js");
const logger = require("./logger");

/**
 * Creates a check to get the binding location
 *
 * @param {*} serviceEl serviceEl
 * @param {*} bindingUri specifies information to communicate with location
 * @returns {*} returns the binding location
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
 * Creates a check to get the first cert
 *
 * @param {*} keyEl keyEl
 * @returns {keyEl}  returns the first cert
 */
function getFirstCert(keyEl) {
  if (
    (keyEl.KeyInfo && keyEl.KeyInfo.length === 1,
    keyEl.KeyInfo[0].X509Data && keyEl.KeyInfo[0].X509Data.length === 1,
    keyEl.KeyInfo[0].X509Data[0].X509Certificate &&
      keyEl.KeyInfo[0].X509Data[0].X509Certificate.length === 1)
  ) {
    return keyEl.KeyInfo[0].X509Data[0].X509Certificate[0]._;
  }
  return null;
}
/**
 * Creates the check for fetching url
 *
 * @param {*} url fetch url
 * @returns {*} returns Promise constructor
 */
export function fetch(url) {
  return new Promise((resolve, reject) => {
    const metadata = { sso: {}, slo: {}, nameIdFormats: [], signingKeys: [] };

    if (typeof url === "undefined" || url === null) {
      return resolve(metadata);
    }

    request.get(url, (err, resp, body) => {
      if (err) {
        return reject(err);
      }

      const parserConfig = {
          explicitRoot: true,
          explicitCharkey: true,
          tagNameProcessors: [xml2js.processors.stripPrefix],
        },
        parser = new xml2js.Parser(parserConfig);

      parser.parseString(body, (err, docEl) => {
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
              if (keyEl.$.use && keyEl.$.use.toLowerCase() !== "encryption") {
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
            let roleEl = docEl.EntityDescriptor.RoleDescriptor.find((el) => {
              return el.$["xsi:type"].endsWith(":SecurityTokenServiceType");
            });
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
    });
  });
}
