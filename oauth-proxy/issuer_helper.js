const { Issuer } = require("openid-client");

const createIssuer = async (serviceConfig) => {
  let discovered_issuer = await Issuer.discover(serviceConfig.upstream_issuer);
  if (serviceConfig.custom_metadata) {
    new Issuer(
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

module.exports = { createIssuer };
