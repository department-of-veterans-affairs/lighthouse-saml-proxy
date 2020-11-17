class PullDocumentByLaunchStrategy {
  constructor(req) {
    this.req = req;
  }
  async pullDocumentFromDynamo() {
    let launch = this.req.body.launch;
    if (launch === undefined || launch === "") {
      return null;
    }

    let document = {
      launch: {
        S: launch,
      },
    };

    return document;
  }
}

module.exports = { PullDocumentByLaunchStrategy };
