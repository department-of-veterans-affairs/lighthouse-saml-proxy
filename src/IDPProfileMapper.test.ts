import "jest";
import { createProfileMapper } from "./IDPProfileMapper";

const idmeAssertions = {
  issuer: "api.idmelabs.com",
  userName: "ae9ff5f4e4b741389904087d94cd19b2",
  nameIdFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  claims: {
    birth_date: "1998-01-23",
    email: "vets.gov.user+20@gmail.com",
    fname: "KELLY",
    social: "123456789",
    gender: "female",
    lname: "CARROLL",
    level_of_assurance: "3",
    mname: "D",
    multifactor: "true",
    uuid: "ae9ff5f4e4b741389904087d94cd19b2",
  },
};

const mhvAssertions = {
  issuer: "api.idmelabs.com",
  userName: "ae9ff5f4e4b741389904087d94cd19b2",
  nameIdFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  claims: {
    email: "vets.gov.user+20@gmail.com",
    mhv_icn: "anICN",
    mhv_profile:
      '{"accountType":"Premium","availableServices":{"21":"VA Medications"}}',
    level_of_assurance: "0",
    multifactor: "true",
    mhv_uuid: "ae9ff5f4e4b741389904087d94cd19b2",
    uuid: "ae9ff5f4e4b741389904087d94cd19b2",
  },
};

const dslogonAssertions = {
  issuer: "api.idmelabs.com",
  userName: "ae9ff5f4e4b741389904087d94cd19b2",
  nameIdFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  claims: {
    dslogon_birth_date: "1998-01-23",
    email: "vets.gov.user+20@gmail.com",
    dslogon_fname: "KELLY",
    dslogon_uuid: "1234567890",
    dslogon_gender: "female",
    dslogon_lname: "CARROLL",
    level_of_assurance: "0",
    dslogon_assurance: "2",
    dslogon_mname: "D",
    multifactor: "true",
    uuid: "ae9ff5f4e4b741389904087d94cd19b2",
  },
};

const loginGovAssertions = {
  issuer: "api.idmelabs.com",
  userName: "ae9ff5f4e4b741389904087d94cd19b2",
  nameIdFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent",
  claims: {
    dob: "1998-01-23",
    email: "vets.gov.user+20@gmail.com",
    first_name: "CARROLL",
    last_name: "KELLY",
    uuid: "ae9ff5f4e4b741389904087d94cd19b2",
    ssn: "123-45-6789",
    phone: "+12345678901",
    aal: "http://idmanagement.gov/ns/assurance/aal/2",
    ial: "http://idmanagement.gov/ns/assurance/ial/2",
    verified_at: "2021-10-12T15:12:15Z",
  },
};

const basicInfoCheck = expect.objectContaining({
  email: "vets.gov.user+20@gmail.com",
  uuid: "ae9ff5f4e4b741389904087d94cd19b2",
  multifactor: "true",
});

const biographicInfo = expect.objectContaining({
  firstName: "KELLY",
  lastName: "CARROLL",
  ssn: "123456789",
  gender: "female",
  dateOfBirth: "1998-01-23",
  middleName: "D",
});

describe("IDPProfileMapper", () => {
  it("should map basic info the same for all providers", () => {
    [
      idmeAssertions,
      mhvAssertions,
      dslogonAssertions,
      loginGovAssertions,
    ].forEach((assertion) => {
      const profile = createProfileMapper(assertion);
      const basicInfo = profile.getMappedClaims();
      expect(basicInfo).toEqual(basicInfoCheck);
    });
  });

  describe("idmeAssertion", () => {
    it("should map the Veteran's level_of_assurance", () => {
      const profile = createProfileMapper(idmeAssertions);
      expect(profile.getMappedClaims().level_of_assurance).toEqual("3");
    });

    it("should map idme specific info", () => {
      const profile = createProfileMapper(idmeAssertions);
      expect(profile.getMappedClaims()).toEqual(biographicInfo);
    });
  });

  describe("dslogonAssertion", () => {
    it("should map biographical info specific to dslogon provider", () => {
      const profile = createProfileMapper(dslogonAssertions);
      expect(profile.getMappedClaims()).toEqual(
        expect.objectContaining({
          firstName: "KELLY",
          lastName: "CARROLL",
          edipi: "1234567890",
          gender: "female",
          dateOfBirth: "1998-01-23",
          middleName: "D",
        })
      );
    });

    it("should map the level of assurance", () => {
      const profile = createProfileMapper(dslogonAssertions);
      expect(profile.getMappedClaims().dslogon_assurance).toEqual("2");
    });
  });

  describe("mhvAssertion", () => {
    it("should map the mhv icn", () => {
      const profile = createProfileMapper(mhvAssertions);
      expect(profile.getMappedClaims().icn).toEqual("anICN");
    });

    it("should map account type from mhv profile", () => {
      const profile = createProfileMapper(mhvAssertions);
      expect(profile.getMappedClaims().mhv_account_type).toEqual("Premium");
    });
  });

  describe("loginGovAssertion", () => {
    it("should map loa", () => {
      const profile = createProfileMapper(loginGovAssertions);
      expect(profile.getMappedClaims().ial).toEqual(2);
    });

    it("should map biographical info specific to loginGov provider", () => {
      const profile = createProfileMapper(loginGovAssertions);
      expect(profile.getMappedClaims()).toEqual(
        expect.objectContaining({
          firstName: "CARROLL",
          lastName: "KELLY",
          ssn: "123456789",
          dateOfBirth: "1998-01-23",
          phone: "+12345678901",
          verifiedAt: "2021-10-12T15:12:15Z",
          aal: "http://idmanagement.gov/ns/assurance/aal/2",
          ial: 2,
        })
      );
    });

    it("Parse hspd12 aal", () => {
      loginGovAssertions.claims.aal =
        "http://idmanagement.gov/ns/assurance/aal/3?hspd12=true";
      const profile = createProfileMapper(loginGovAssertions);
      const claims = profile.getMappedClaims();
      expect(claims.aal).toEqual(3);
    });
  });
});
