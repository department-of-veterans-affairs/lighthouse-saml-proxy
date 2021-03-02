/** @module issuer_helper */
const { Issuer } = require("openid-client");

/**
 * Overrides default metadata endpoints for issuer if necessary.
 *
 * @param {*} serviceConfig Object of metadata endpoints.
 */
const buildIssuer = async (serviceConfig) => {
  let discovered_issuer = await Issuer.discover(serviceConfig.upstream_issuer);
  if (serviceConfig.custom_metadata) {
    return new Issuer(
      overrideMetadata(
        serviceConfig.custom_metadata,
        discovered_issuer.metadata
      )
    );
  }
  return discovered_issuer;
};

const overrideMetadata = (serviceConfig, discover_metadata) => {
  Object.entries(serviceConfig).forEach(([key, value]) => {
    if (value) {
      discover_metadata[key] = value;
    }
  });
  return discover_metadata;
};

module.exports = { buildIssuer };
