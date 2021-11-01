export const BINDINGS = {
  REDIRECT: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
  POST: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
};

//https://developers.login.gov/saml/#identity-assurance-level-ial
export const IDENTITYPROTOCOL = {
  BASIC: "http://idmanagement.gov/ns/assurance/ial/1",
  IDENTITY_VERIFIED: "http://idmanagement.gov/ns/assurance/ial/2",
  IDENTITY_VERIFIED_LIVENESS: "http://idmanagement.gov/ns/assurance/aal/3",
};

//https://developers.login.gov/saml/#authentication-assurance-level-aal
export const PASSWORDPROTOCOL = {
  DEFAULT: "urn:gov:gsa:ac:classes:sp:PasswordProtectedTransport:duo",
  MULTIFACTOR_TWELVE: "http://idmanagement.gov/ns/assurance/aal/2",
  CRYPTOGRAPHICALLYSECURE: "http://idmanagement.gov/ns/assurance/aal/3",
  HSPD12: "http://idmanagement.gov/ns/assurance/aal/3?hspd12=true",
};
