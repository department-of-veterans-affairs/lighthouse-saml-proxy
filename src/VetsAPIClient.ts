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

    try {
      const response = await axios({
        method: "post",
        url: `${this.apiHost}${MVI_PATH}`,
        headers: this.headers,
        data: body,
      });
      return response.data.attributes;
    } catch (err) {
      const statusCodeError = this.createStatusCodeError(err);
      throw statusCodeError;
    }
  }

  public async getVSOSearch(
    firstName: string,
    lastName: string
  ): Promise<{ poa: string }> {
    const qs = {
      first_name: firstName,
      last_name: lastName,
    };

    try {
      const response = await axios({
        method: "get",
        url: `${this.apiHost}${VSO_SEARCH_PATH}`,
        headers: this.headers,
        data: qs,
      });
      return response.data.data.attributes;
    } catch (err) {
      const statusCodeError = this.createStatusCodeError(err);
      throw statusCodeError;
    }
  }

  private createStatusCodeError(err: any) {
    let response;
    if (err.response) {
      response = err.response;
    }

    let statusCode;
    if (response && response.status) {
      statusCode = String(response.status);
    } else {
      statusCode = "500";
    }

    let message;
    if (err.message) {
      message = err.message;
    } else {
      message = "Internal error";
    }

    const statusCodeError = {
      name: "StatusCodeError",
      statusCode: statusCode,
      response: response,
      message: message,
    };
    return statusCodeError;
  }
}
