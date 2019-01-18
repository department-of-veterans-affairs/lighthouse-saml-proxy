import * as request from 'request-promise-native';

export interface SAMLUser {
  dateOfBirth: string;
  firstName: string;
  gender: string;
  lastName: string;
  middleName: string;
  ssn: string;
  edipi?: string;
}

const LOOKUP_PATH = '/internal/openid_auth/v0/mvi-users';

export class VetsAPIClient {
  token: string;
  apiHost: string;

  constructor(token: string, apiHost: string) {
    this.token = token;
    this.apiHost = apiHost;
  }

  public async getICN(user: SAMLUser) {
    const headers = (user.edipi) ?
      {
        'apiKey': this.token,
        'x-va-edipi': user.edipi
      } :
      {
        'apiKey': this.token,
        'x-va-ssn': user.ssn,
        'x-va-first-name': user.firstName,
        'x-va-middle-name': user.middleName,
        'x-va-last-name': user.lastName,
        'x-va-dob': user.dateOfBirth,
        'x-va-gender': user.gender,
      };
    const response = await request.get({
      url: `${this.apiHost}${LOOKUP_PATH}`,
      json: true,
      headers,
    });
    return response.data.attributes.icn;
  }
}
