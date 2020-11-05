class GetPatientInfoFromLaunchStrategy {
  constructor(req) {
    this.req = req;
  }
  // eslint-disable-next-line no-unused-vars
  async createPatientInfo(tokens, decoded) {
    //Consider some validation on the request body here
    return this.req.body.launch;
  }
}
module.exports = { GetPatientInfoFromLaunchStrategy };
