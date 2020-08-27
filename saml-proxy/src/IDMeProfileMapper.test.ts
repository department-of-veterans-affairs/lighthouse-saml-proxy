import "jest";
import { createProfileMapper } from "./IDMeProfileMapper";

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

describe("IDMeProfileMapper", () => {
  it("should map basic info the same for all providers", () => {
    [idmeAssertions, mhvAssertions, dslogonAssertions].forEach((assertion) => {
      const profile = createProfileMapper(assertion);
      expect(profile.getMappedClaims()).toEqual(basicInfoCheck);
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
});
