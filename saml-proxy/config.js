/**
 * SAML Attribute Metadata. This file is required to generate correct idp metadata
 */
var metadata = [
  {
    id: "email",
    optional: false,
    displayName: 'E-Mail Address',
    description: 'The e-mail address of the user',
    multiValue: false
  },
  {
    id: "uuid",
    optional: false,
    displayName: 'uuid',
    description: 'IdP-generated UUID of the user',
    multiValue: false
  },
  {
    id: "firstName",
    optional: true,
    displayName: 'First Name',
    description: 'The given name of the user',
    multiValue: false
  },
  {
    id: "lastName",
    optional: true,
    displayName: 'Last Name',
    description: 'The surname of the user',
    multiValue: false
  },
  {
    id: "middleName",
    optional: true,
    displayName: 'Middle Name',
    description: 'The middle name of the user',
    multiValue: false
  },
];

module.exports = {}
