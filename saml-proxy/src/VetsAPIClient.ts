import * as request from 'request-promise-native';

export interface SAMLUser {
  dateOfBirth: string;
  firstName: string;
  gender: string;
  lastName: string;
  middleName: string;
  ssn: string;
}


export class VetsAPIClient {
  token: string;
  apiHost: string;

  constructor(token: string, apiHost: string) {
    this.token = token;
    this.apiHost = apiHost;
  }

  public async getICN(user: SAMLUser) {
    const response = await request.get({
      url: `${this.apiHost}/internal/openid_auth/v0/mvi-lookup`,
      json: true,
      headers: {
        'apiKey': this.token,
        'x-va-ssn': user.ssn,
        'x-va-first-name': user.firstName,
        'x-va-middle-name': user.middleName,
        'x-va-last-name': user.lastName,
        'x-va-dob': user.dateOfBirth,
        'x-va-gender': user.gender,
      },
    });
    return response.data.attributes.icn;
  }
}
