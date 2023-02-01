import { SAMLUser } from "../src/SAMLUser";

export default class MockMpiUserClient {
  public findUserInMVI = true;
  public userIsVSO = true;

  public async getMpiTraitsForLoa3User(
    user: SAMLUser
  ): Promise<{ icn: string; first_name: string; last_name: string }> {
    if (this.findUserInMVI) {
      return {
        icn: "123",
        first_name: user.firstName,
        last_name: user.lastName,
      };
    }

    const error = new Error("Not found");
    error.name = "StatusCodeError";
    error.statusCode = "404";
    throw error;
  }

  public reset() {
    this.findUserInMVI = true;
  }
}
