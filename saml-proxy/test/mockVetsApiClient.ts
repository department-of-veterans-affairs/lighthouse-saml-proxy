export default class MockVetsApiClient {
  public findUserInMVI = true;
  public userIsVSO = true;

  public reset() {
    this.findUserInMVI = true;
    this.userIsVSO = true;
  }
}
