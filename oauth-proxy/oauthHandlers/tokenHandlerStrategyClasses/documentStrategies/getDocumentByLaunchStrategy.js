class GetDocumentByLaunchStrategy {
  constructor(req) {
    this.req = req;
  }
  async getDocument() {
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

module.exports = { GetDocumentByLaunchStrategy };
