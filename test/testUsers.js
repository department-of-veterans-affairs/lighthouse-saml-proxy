export const MHV_USER = "mhv";
export const IDME_USER = "idme";
export const DSLOGON_USER = "dslogon";

function mhvUser(level_of_assurance) {
  const loa = level_of_assurance === "3" ? "Premium" : "Standard";
  return {
    issuer: "test",
    userName: "ae9ff5f4e4b741389904087d94cd19b2",
    nameIdFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    claims: {
      email: "va.api.user+idme.001@gmail.com",
      mhv_profile: `{"accountType":"${loa}","availableServices":{"21":"VA Medications"}}`,
      level_of_assurance: "0",
      multifactor: "true",
      mhv_uuid: "ae9ff5f4e4b741389904087d94cd19b2",
      uuid: "ae9ff5f4e4b741389904087d94cd19b2",
    },
  };
}

function dslogonUser(level_of_assurance) {
  const loa = level_of_assurance === "3" ? "3" : "1";
  return {
    issuer: "test",
    userName: "ae9ff5f4e4b741389904087d94cd19b2",
    nameIdFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    claims: {
      dslogon_birth_date: "1998-01-23",
      email: "va.api.user+idme.001@gmail.com",
      dslogon_fname: "TAMERA",
      dslogon_uuid: "1234567890",
      dslogon_gender: "female",
      dslogon_lname: "ELLIS",
      level_of_assurance: "0",
      dslogon_assurance: loa,
      dslogon_mname: "E",
      multifactor: "true",
      uuid: "ae9ff5f4e4b741389904087d94cd19b2",
    },
  };
}

function idmeUser(level_of_assurance) {
  return {
    issuer: "test",
    userName: "ae9ff5f4e4b741389904087d94cd19b2",
    nameIdFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
    claims: {
      birth_date: "1998-01-23",
      email: "va.api.user+idme.001@gmail.com",
      fname: "TAMERA",
      social: "123456789",
      gender: "female",
      lname: "ELLIS",
      level_of_assurance: level_of_assurance,
      mname: "E",
      multifactor: "true",
      uuid: "ae9ff5f4e4b741389904087d94cd19b2",
    },
  };
}

export function getUser(type, level_of_assurance) {
  switch (type) {
    case IDME_USER:
      return idmeUser(level_of_assurance);
    case DSLOGON_USER:
      return dslogonUser(level_of_assurance);
    case MHV_USER:
      return mhvUser(level_of_assurance);
  }
}
