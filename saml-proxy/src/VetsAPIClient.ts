import * as request from 'request-promise-native';

export interface SAMLUser {
  dateOfBirth: string;
  email: string;
  firstName: string;
  gender: string;
  lastName: string;
  middleName: string;
  ssn: string;
  edipi?: string;
}

const LOOKUP_PATH = '/internal/auth/v0/mvi-user';

export class VetsAPIClient {
  token: string;
  apiHost: string;

  constructor(token: string, apiHost: string) {
    this.token = token;
    this.apiHost = apiHost;
  }

  public async getICNForLoa3User(user: SAMLUser) : Promise<string> {
    const headers = (user.edipi) ?
      {
        'apiKey': this.token,
        'x-va-edipi': user.edipi,
        'x-va-user-email': user.email,
        'x-va-level-of-assurance': '3',
      } :
      {
        'apiKey': this.token,
        'x-va-user-email': user.email,
        'x-va-ssn': user.ssn,
        'x-va-first-name': user.firstName,
        'x-va-middle-name': user.middleName,
        'x-va-last-name': user.lastName,
        'x-va-dob': user.dateOfBirth,
        'x-va-gender': user.gender,
        'x-va-level-of-assurance': '3',
      };
    const response = await request.get({
      url: `${this.apiHost}${LOOKUP_PATH}`,
      json: true,
      headers,
    });
    return response.data.attributes.icn;
  }
}
