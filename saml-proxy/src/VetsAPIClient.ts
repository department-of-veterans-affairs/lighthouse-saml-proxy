import * as request from 'request-promise-native';

export interface SAMLUser {
  uuid: string;
  dateOfBirth?: string;
  email: string;
  firstName?: string;
  gender?: string;
  lastName?: string;
  middleName?: string;
  ssn?: string;
  edipi?: string;
  icn?: string;
}

const LOOKUP_PATH = '/internal/auth/v0/mvi-user';

export class VetsAPIClient {
  token: string;
  apiHost: string;

  constructor(token: string, apiHost: string) {
    this.token = token;
    this.apiHost = apiHost;
  }

  public async getMVITraitsForLoa3User(user: SAMLUser) : Promise<{ icn: string, first_name: string, last_name: string }> {
    const headers = {
      'apiKey': this.token,
      'x-va-idp-uuid': user.uuid,
      'x-va-user-email': user.email,
      'x-va-dslogon-edipi': user.edipi || null,
      'x-va-mhv-icn': user.icn || null,
      'x-va-ssn': user.ssn || null,
      'x-va-first-name': user.firstName || null,
      'x-va-middle-name': user.middleName || null,
      'x-va-last-name': user.lastName || null,
      'x-va-dob': user.dateOfBirth || null,
      'x-va-gender': user.gender || null,
      'x-va-level-of-assurance': '3',
    };
    const response = await request.get({
      url: `${this.apiHost}${LOOKUP_PATH}`,
      json: true,
      headers,
    });
    return response.data.attributes;
  }
}
