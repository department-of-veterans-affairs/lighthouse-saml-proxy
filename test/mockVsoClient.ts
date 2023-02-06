export default class MockVsoClient {
  public userIsVSO = true;

  /*
   * Mock VSO search.
   *
   * Params are unused but are present to mimic real signature.
   */
  public async getVSOSearch(
    firstName: string, // eslint-disable-line
    lastName: string // eslint-disable-line
  ): Promise<{ poa: string }> {
    if (this.userIsVSO) {
      return {
        poa: "poa",
      };
    }

    throw new Error("Not found");
  }

  public reset() {
    this.userIsVSO = true;
  }
}
