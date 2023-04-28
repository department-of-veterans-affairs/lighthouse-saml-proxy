
import { SAMLUser } from "../src/SAMLUser";

export default class MockMpiUserClient {
  public findUserInMVI = true;

  public async getMpiTraitsForLoa3User(
    user: SAMLUser
  ): Promise<{ icn: string; first_name: string | undefined; last_name: string | undefined }> {
    if (this.findUserInMVI) {
      return {
        icn: "123",
        first_name: user.firstName,
        last_name: user.lastName,
      };
    }

    const error = new Error("Not found");
    error.name = "MPILookupFailure";
    // @ts-ignore
    error.statusCode= 404;
    throw error;
  }

  public reset() {
    this.findUserInMVI = true;
  }
}
