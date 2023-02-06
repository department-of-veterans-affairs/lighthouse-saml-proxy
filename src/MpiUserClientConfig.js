export default class MpiUserClientConfig {
  constructor(argv) {
    this.mpiUserEndpoint = argv.mpiUserEndpoint;
    this.accessKey = argv.accessKey;
    this.apiKey = argv.vetsAPIToken;
  }
}
