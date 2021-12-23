import axios from "axios";

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

const MVI_PATH = "/internal/auth/v0/mvi-user";
const VSO_SEARCH_PATH = "/services/veteran/v0/representatives/find_rep";

export class VetsAPIClient {
  token: string;
  apiHost: string;
  headers: object;

  constructor(token: string, apiHost: string) {
    this.token = token;
    this.apiHost = apiHost;
    this.headers = {
      apiKey: this.token,
    };
  }

  public async getMVITraitsForLoa3User(
    user: SAMLUser
  ): Promise<{ icn: string; first_name: string; last_name: string }> {
    const body = {
      idp_uuid: user.uuid,
      user_email: user.email,
      dslogon_edipi: user.edipi || null,
      mhv_icn: user.icn || null,
      ssn: user.ssn || null,
      first_name: user.firstName || null,
      middle_name: user.middleName || null,
      last_name: user.lastName || null,
      dob: user.dateOfBirth || null,
      gender: user.gender || null,
      level_of_assurance: "3",
    };
    const out = { icn: "-1", first_name: "first_name", last_name: "last_name" };

    try {
      const response = await axios({
        method: "post",
        url: `${this.apiHost}${MVI_PATH}`,
        headers: this.headers,
        data: body,
      });

      Object.assign(out, response.data.data.attributes);
    } catch (err) {
      console.error(err);
    }
    return out;
  }

  public async getVSOSearch(
    firstName: string,
    lastName: string
  ): Promise<{ poa: string }> {
    const qsPayload = {
      first_name: firstName,
      last_name: lastName,
    };

    try {
      const response = await axios({
        method: "get",
        url: `${this.apiHost}${VSO_SEARCH_PATH}`,
        headers: this.headers,
        data: qsPayload,
      });
      return response.data.data.attributes;
    } catch (err) {
      console.error(err);
    }
    return { poa: "poa" };
  }
}
