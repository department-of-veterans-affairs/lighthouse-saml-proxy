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

const MVI_PATH = '/internal/auth/v0/mvi-user';

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
    };

    const body = {
      'idp_uuid': user.uuid,
      'user_email': user.email,
      'dslogon_edipi': user.edipi || null,
      'mhv_icn': user.icn || null,
      'ssn': user.ssn || null,
      'first_name': user.firstName || null,
      'middle_name': user.middleName || null,
      'last_name': user.lastName || null,
      'dob': user.dateOfBirth || null,
      'gender': user.gender || null,
      'level_of_assurance': '3',
    };

    const response = await request.post({
      url: `${this.apiHost}${MVI_PATH}`,
      json: true,
      headers,
      body,
    });
    return response.data.attributes;
  }
}
