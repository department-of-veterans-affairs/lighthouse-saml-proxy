/**
 * SAML Attribute Metadata
 */
var metadata = [
// Common attributes
// DSLogon-specific attributes
// MHV-specific attributes
{
  id: "mhv_uuid",
  optional: true,
  displayName: 'MHV UUID',
  description: 'MHV-reported UUID',
  multiValue: false
}, {
  id: "mhv_profile",
  optional: true,
  displayName: 'MHV user profile',
  description: 'MHV user profile, includes account status',
  multiValue: false
}, {
  id: "mhv_icn",
  optional: true,
  displayName: 'MHV ICN',
  description: 'MHV-reported ICN',
  multiValue: false
}, {
  id: "mhv_account_type",
  optional: true,
  displayName: 'MHV account type',
  description: 'MHV account type',
  multiValue: false,
  transformer: function (claims) {
    if (claims && claims.mhv_profile) {
      return JSON.parse(claims.mhv_profile).accountType;
    }
    return undefined;
  }
}
];

module.exports = {
  metadata: metadata
}
