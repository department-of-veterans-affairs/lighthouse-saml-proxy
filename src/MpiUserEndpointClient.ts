import * as request from "request-promise-native";
import { SAMLUser } from "./SAMLUser";

export class MpiUserEndpointClient {
  token: string;
  mpiUserEndpoint: string;
  headers: object;

  constructor(token: string, mpiUserEndpoint: string) {
    this.token = token;
    this.mpiUserEndpoint = mpiUserEndpoint;
    this.headers = {
      apiKey: this.token,
    };
  }

  public async getMpiTraitsForLoa3User(
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

    const response = await request.post({
      url: this.mpiUserEndpoint,
      json: true,
      headers: this.headers,
      body,
    });
    return response.data.attributes;
  }
}
