import { SAMLUser } from "./SAMLUser";
import axios from "axios";

export class MpiUserClient {
  mpiUserEndpoint: string;
  headers: object;
  fraudIdTheft: boolean;

  constructor(
    apiKey: string,
    mpiUserEndpoint: string,
    accessKey: string,
    fraudIdTheft: boolean
  ) {
    this.mpiUserEndpoint = mpiUserEndpoint;
    this.headers = {
      apiKey: apiKey,
      accesskey: accessKey,
    };
    this.fraudIdTheft = fraudIdTheft;
  }

  public async getMpiTraitsForLoa3User(
    user: SAMLUser
  ): Promise<{
    icn: string;
    first_name: string;
    last_name: string;
    idTheftIndicator: boolean;
  }> {
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

    return axios
      .post(this.mpiUserEndpoint, body, {
        headers: this.headers,
      })
      .then((response) => {
        const data = response.data.data;
        return {
          icn: data.attributes.icn,
          first_name: data.attributes.first_name,
          last_name: data.attributes.last_name,
          idTheftIndicator: data.id_theft_indicator || false,
        };
      })
      .catch(() => {
        throw {
          name: "MPILookupFailure",
          statusCode: 404,
          message: "Error with MPI Lookup",
        };
      });
  }
}
