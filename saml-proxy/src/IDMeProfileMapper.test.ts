import 'jest';
import { createProfileMapper } from './IDMeProfileMapper';

const idmeAssertions = {
  issuer: 'api.idmelabs.com',
  userName: 'ae9ff5f4e4b741389904087d94cd19b2',
  nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  authnContext: {
    sessionIndex: '_dda86128dbf14a9b8643daadab889d54',
    authnMethod: 'http://idmanagement.gov/ns/assurance/loa/3'
  },
  claims: {
    birth_date: '1998-01-23',
    email: 'vets.gov.user+20@gmail.com',
    fname: 'KELLY',
    social: '123456789',
    gender: 'female',
    lname: 'CARROLL',
    level_of_assurance: '3',
    mname: 'D',
    multifactor: 'true',
    uuid: 'ae9ff5f4e4b741389904087d94cd19b2'
  }
}

const basicInfoCheck = expect.objectContaining({
  email: 'vets.gov.user+20@gmail.com',
  uuid: 'ae9ff5f4e4b741389904087d94cd19b2',
  multifactor: 'true',
})

const biographicInfo = expect.objectContaining({
  firstName: 'KELLY',
  lastName: 'CARROLL',
  ssn: '123456789',
  gender: 'female',
  dateOfBirth: '1998-01-23',
  middleName: 'D',
});

describe('IDMeProfileMapper', () => {
  it('should map basic info for ', () => {
    const profile = createProfileMapper(idmeAssertions);
    expect(profile.getMappedClaims()).toEqual(basicInfoCheck);
  });

  it('should map the Veteran\'s level_of_assurance', () => {
    const profile = createProfileMapper(idmeAssertions);
    expect(profile.getMappedClaims().level_of_assurance).toEqual('3');
  });

  it('should map idme specific info', () => {
    const profile = createProfileMapper(idmeAssertions);
    expect(profile.getMappedClaims()).toEqual(biographicInfo);
  });
});
