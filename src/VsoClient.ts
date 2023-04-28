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
    return axios
      .get(this.vsoEndpointUrl, {
        headers: this.headers,
        params: qs,
      })
      .then((response) => {
        const data = response.data.data;
        return data.attributes;
      })
      .catch((error) => {
        throw error;
      });
  }
}
