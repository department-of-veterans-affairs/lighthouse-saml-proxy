export const BINDINGS = {
  REDIRECT: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
  POST: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
};

export const PASSWORDPROTOCOL = {
  DEFAULT: "urn:gov:gsa:ac:classes:sp:PasswordProtectedTransport:duo",
  MULTIFACTOR: "http://idmanagement.gov/ns/assurance/aal/2",
  CRYPTOGRAPHICALLYSECURE: "http://idmanagement.gov/ns/assurance/aal/3",
  HSPD12: "http://idmanagement.gov/ns/assurance/aal/3?hspd12=true",
};

export const SUFFICIENT_AAL = [
  PASSWORDPROTOCOL.DEFAULT,
  PASSWORDPROTOCOL.MULTIFACTOR,
  PASSWORDPROTOCOL.CRYPTOGRAPHICALLYSECURE,
  PASSWORDPROTOCOL.HSPD12,
];