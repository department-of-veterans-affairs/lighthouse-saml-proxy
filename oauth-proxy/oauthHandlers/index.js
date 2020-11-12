// This module should eventually contain an express route handler for each
// official OAuth 2.0 endpoint.
module.exports = {
  authorizeHandler: require("./authorizeHandler"),
  tokenHandler: require("./tokenHandler"),
  redirectHandler: require("./redirectHandler"),
  revokeUserGrantHandler: require("./revokeUserGrantHandler"),
  launchRequestHandler: require("./launchRequestHandler"),
};
