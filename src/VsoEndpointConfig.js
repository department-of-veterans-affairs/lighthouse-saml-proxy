export default class VsoEndpointConfig {
  constructor(argv) {
    this.token = argv.vetsAPIToken;
    this.vsoUserEndpoint = argv.vsoUserEndpoint;
  }
}
