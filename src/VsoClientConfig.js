export default class VsoClientConfig {
  constructor(argv) {
    this.token = argv.vetsAPIToken;
    this.vsoUserEndpoint = argv.vsoUserEndpoint;
  }
}
