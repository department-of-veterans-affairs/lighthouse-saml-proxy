/* eslint-disable jsdoc/require-returns */
import "jest";
import { selectPassportStrategyKey } from "./passport";
import { dataFromFile } from "../../test/testUtils";

const mockReq = {
  headers: {
    origin: "http://login.example1.com",
  },
  sps: {
    options: {
      idp1: {
        category: "idp1",
        idpMetaUrl: "https://api.idmelabs.com/saml/metadata/provider",
      },
      idp2: {
        category: "idp2",
        idpMetaUrl: "https://idp.int.identitysandbox.gov/api/saml/metadata2023",
      },
      idp3: {
        category: "idp3",
        idpMetaUrl:
          "http://localhost:9080/realms/mockidp/protocol/saml/descriptor",
      },
      idp4: {
        category: "idp4",
        idpMetaUrl:
          "https://deptva.oktapreview.com/app/exk9rdi3kczXMv1tB1d7/sso/saml/metadata",
      },
    },
  },
};
describe("selectPassportStrategyKey", () => {
  test("selectPassportStrategyKey idp1", () => {
    mockReq.body = { SAMLResponse: dataFromFile("idme_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp1");
  });
  test("selectPassportStrategyKey idp2", () => {
    mockReq.body = { SAMLResponse: dataFromFile("logingov_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp2");
  });

  test("selectPassportStrategyKey idp3", () => {
    mockReq.body = { SAMLResponse: dataFromFile("keycloak_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp3");
  });

  test("selectPassportStrategyKey idp4", () => {
    mockReq.body = { SAMLResponse: dataFromFile("okta_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp4");
  });

  test("selectPassportStrategyKey default 'idp1'", () => {
    mockReq.body = {
      SAMLResponse: dataFromFile("unmatched_example.xml.b64"),
    };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp1");
  });
});
