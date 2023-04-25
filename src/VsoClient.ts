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

    const response = await axios.post(this.vsoEndpointUrl, qs, {
      headers: this.headers,
    });
    return response.data.attributes;
  }
}
