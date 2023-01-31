import * as request from "request-promise-native";
import { SAMLUser } from "./SAMLUser";

export class MpiUserEndpointClient {
  mpiUserEndpoint: string;
  headers: object;

  constructor(apiKey: string, mpiUserEndpoint: string, accessKey: string) {
    this.mpiUserEndpoint = mpiUserEndpoint;
    this.headers = {
      apiKey: apiKey,
      accesskey: accessKey,
    };
  }

  public async getMpiTraitsForLoa3User(
    user: SAMLUser
  ): Promise<{ icn: string; first_name: string; last_name: string }> {
    const body: Record<string, any> = {
      idp_uuid: user.uuid,
      dslogon_edipi: user.edipi || null,
      mhv_icn: user.icn || null,
      ssn: user.ssn || null,
      first_name: user.firstName || null,
      middle_name: user.middleName || null,
      last_name: user.lastName || null,
      dob: user.dateOfBirth || null,
      gender: user.gender?.substring(0, 1).toUpperCase() || null,
    };

    if (this.mpiUserEndpoint.includes("v0/")) {
      body["level_of_assurance"] = "3";
    }

    const response = await request.post({
      url: this.mpiUserEndpoint,
      json: true,
      headers: this.headers,
      body,
    });
    return response.data.attributes;
  }
}
