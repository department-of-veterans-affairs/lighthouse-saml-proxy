import * as request from "request-promise-native";

export class VetsAPIClient {
  token: string;
  vsoEndpointUrl: string;
  headers: object;

  constructor(token: string, vsoEndpointUrl: string) {
    this.token = token;
    this.vsoEndpointUrl = vsoEndpointUrl;
    this.headers = {
      apiKey: this.token,
    };
  }

  public async getVSOSearch(
    firstName: string,
    lastName: string
  ): Promise<{ poa: string }> {
    const qs = {
      first_name: firstName,
      last_name: lastName,
    };

    const response = await request.get({
      url: this.vsoEndpointUrl,
      json: true,
      headers: this.headers,
      qs,
    });
    return response.data.attributes;
  }
}
