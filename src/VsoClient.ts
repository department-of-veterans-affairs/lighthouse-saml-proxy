//import axios from "axios";
import * as request from "request-promise-native";

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
//     const response = await axios.get(this.vsoEndpointUrl, {
//       headers: this.headers,
//       params: qs,
//     });
//     return response.data.attributes;
//   }
// }

    const response = await request.get({
      url: this.vsoEndpointUrl,
      json: true,
      headers: this.headers,
      qs,
    });
    return response.data.attributes;
  }
}
