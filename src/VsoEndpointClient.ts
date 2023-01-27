import * as request from "request-promise-native";

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

  public async getVSOSearch(
    firstName: string,
    lastName: string
  ): Promise<{ poa: string }> {
    const qs = {
      first_name: firstName,
      last_name: lastName,
    };

    const response = await request.get({
      url: `${this.apiHost}${VSO_SEARCH_PATH}`,
      json: true,
      headers: this.headers,
      qs,
    });
    return response.data.attributes;
  }
}
