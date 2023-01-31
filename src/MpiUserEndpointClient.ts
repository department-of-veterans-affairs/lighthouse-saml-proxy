import * as request from "request-promise-native";
import { SAMLUser } from "./SAMLUser";

export class MpiUserEndpointClient {
  accessKey: string;
  mpiUserEndpoint: string;
  apiKey: string;
  headers: object;

  constructor(accessKey: string, mpiUserEndpoint: string, apiKey: string) {
    this.accessKey = accessKey;
    this.mpiUserEndpoint = mpiUserEndpoint;
    this.apiKey = apiKey;
    this.headers = {
      apiKey: this.apiKey,
      access_key: this.accessKey,
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
