export default class MpiUserEndpointConfig {
  constructor(argv) {
    this.mpiUserEndpoint = argv.mpiUserEndpoint;
    this.accessKey = argv.accessKey;
    this.apiKey = argv.apiKey;
  }
}
