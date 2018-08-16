
/**
 * User Profile
 */
var profile = {
  birth_date: '1936-04-10',
  email: 'vets.gov.user+503@id.me',
  fname: 'Wendeline',
  social: '564930708',
  gender: 'Female',
  lname: 'O\'Heffernan',
  level_of_assurance: '3',
  mname: 'Kitty',
  multifactor: 'true',
  uuid: '43bb64d44a44452a8b30929003a89f53'
}

/**
 * SAML Attribute Metadata
 */
var metadata = [{
  id: "fname",
  optional: false,
  displayName: 'First Name',
  description: 'The given name of the Veteran',
  multiValue: false
}, {
  id: "lname",
  optional: false,
  displayName: 'Last Name',
  description: 'The surname of the Veteran',
  multiValue: false
}, {
  id: "mname",
  optional: true,
  displayName: 'Middle Name',
  description: 'The middle name of the Veteran',
  multiValue: false
}, {
  id: "email",
  optional: false,
  displayName: 'E-Mail Address',
  description: 'The e-mail address of the Veteran',
  multiValue: false
},{
  id: "social",
  optional: true,
  displayName: 'SSN',
  description: 'The SSN of the Veteran',
  multiValue: false
}, {
  id: "multifactor",
  optional: true,
  displayName: 'Multifactor',
  description: 'If the Veteran has two factor auth enabled',
  multiValue: false
}, {
  id: "gender",
  optional: true,
  displayName: 'Gender',
  description: 'The gender of the Veteran',
  multiValue: false
}, {
  id: "uuid",
  optional: true,
  displayName: 'uuid',
  description: 'UUID of the Veteran model',
  multiValue: false
}, {
  id: "level_of_assurance",
  optional: true,
  displayName: 'Level of Assurance',
  description: 'Level of identify proofing available for the Veteran',
  multiValue: false
}, {
  id: "birth_date",
  optional: false,
  displayName: 'Birth Date',
  description: 'The birth date of the Veteran',
  multiValue: false
}];

module.exports = {
  user: profile,
  metadata: metadata
}
