export default class VetsApiConfig {
  constructor(argv) {
    this.token = argv.vetsAPIToken;
    this.apiHost = argv.vetsAPIHost;
  }
}
