/**
 * SAML Attribute Metadata
 */
var metadata = [
// Common attributes
{
  id: "email",
  optional: false,
  displayName: 'E-Mail Address',
  description: 'The e-mail address of the user',
  multiValue: false
}, {
  id: "level_of_assurance",
  optional: false,
  displayName: 'Level of Assurance',
  description: 'Level of identify proofing available for the user',
  multiValue: false
}, {
  id: "multifactor",
  optional: false,
  displayName: 'Multifactor',
  description: 'If the user has two factor auth enabled',
  multiValue: false
}, {
  id: "uuid",
  optional: false,
  displayName: 'uuid',
  description: 'IdP-generated UUID of the user',
  multiValue: false
},
// ID.me-specific attributes
{
  id: "fname",
  optional: true,
  displayName: 'First Name',
  description: 'The given name of the user',
  multiValue: false
}, {
  id: "lname",
  optional: true,
  displayName: 'Last Name',
  description: 'The surname of the user',
  multiValue: false
}, {
  id: "mname",
  optional: true,
  displayName: 'Middle Name',
  description: 'The middle name of the user',
  multiValue: false
}, {
  id: "social",
  optional: true,
  displayName: 'SSN',
  description: 'The SSN of the user',
  multiValue: false
}, {
  id: "gender",
  optional: true,
  displayName: 'Gender',
  description: 'The administrative gender of the user',
  multiValue: false
},
// DSLogon-specific attributes
{
  id: "birth_date",
  optional: true,
  displayName: 'Birth Date',
  description: 'The birth date of the user',
  multiValue: false
}, {
  id: "dslogon_birth_date",
  optional: true,
  displayName: 'Birth Date',
  description: 'DSLogon-reported birth date of the user',
  multiValue: false
}, {
  id: "dslogon_deceased",
  optional: true,
  displayName: 'Deceased',
  description: 'DSLogon-reported deceased indicator for the user',
  multiValue: false
}, {
  id: "dslogon_fname",
  optional: true,
  displayName: 'First Name',
  description: 'DSLogon-reported first name of the user',
  multiValue: false
}, {
  id: "dslogon_lname",
  optional: true,
  displayName: 'Last Name',
  description: 'DSLogon-reported last name of the user',
  multiValue: false
}, {
  id: "dslogon_mname",
  optional: true,
  displayName: 'Middle Name',
  description: 'DSLogon-reported middle name of the user',
  multiValue: false
}, {
  id: "dslogon_gender",
  optional: true,
  displayName: 'Gender',
  description: 'DSLogon-reported administrative gender of the user',
  multiValue: false
}, {
  id: "dslogon_idvalue",
  optional: true,
  displayName: 'ID Value',
  description: 'DSLogon-reported SSN of the user',
  multiValue: false
}, {
  id: "dslogon_idtype",
  optional: true,
  displayName: 'ID Type',
  description: 'DSLogon-reported SSN indicator',
  multiValue: false
}, {
  id: "dslogon_assurance",
  optional: true,
  displayName: 'Level of assurance',
  description: 'DSLogon-reported level of assurance',
  multiValue: false
}, {
  id: "dslogon_status",
  optional: true,
  displayName: 'Veteran status',
  description: 'DSLogon-reported veteran status',
  multiValue: false
}, {
  id: "dslogon_uuid",
  optional: true,
  displayName: 'DS Logon UUID',
  description: 'DSLogon-reported UUID aka EDIPI',
  multiValue: false
},
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
