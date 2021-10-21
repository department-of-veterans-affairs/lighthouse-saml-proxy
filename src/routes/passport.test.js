import "jest";
import { selectPassportStrategyKey } from "./passport";

const mockReq = {
  headers: {
    origin: "http://login.example1.com",
  },
  sps: {
    options: {
      idp1: {
        idpSsoUrl: "http://login.example1.com/saml/sso",
      },
      idp2: {
        idpSsoUrl: "http://login.example2.com/saml/sso",
      },
    },
  },
};
describe("selectPassportStrategyKey", () => {
  test("selectPassportStrategyKey idp1", () => {
    expect(selectPassportStrategyKey(mockReq)).toBe("idp1");
  });
  test("selectPassportStrategyKey idp2", () => {
    mockReq.headers.origin = "http://login.example2.com";
    expect(selectPassportStrategyKey(mockReq)).toBe("idp2");
  });
  test("selectPassportStrategyKey default 'id_me'", () => {
    mockReq.headers.origin = "http://login.example0.com";
    expect(selectPassportStrategyKey(mockReq)).toBe("id_me");
  });
});
