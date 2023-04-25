import axios from "axios";
export class VsoClient {
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

    const config = {
      method: "get",
      url: this.vsoEndpointUrl,
      headers: this.headers,
      qs,
    };

    const response = await axios(config);
    return response.data.attributes;
  }
}
