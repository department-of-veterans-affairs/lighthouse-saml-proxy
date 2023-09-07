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
        idpMetaUrl: "https://api.idp1.com/saml/metadata/provider",
      },
      idp2: {
        category: "idp2",
        idpMetaUrl: "https://idp.int.idp2.org/api/saml/metadata2023",
      },
      idp3: {
        category: "idp3",
        idpMetaUrl: "https://idp3:18443/realms/xxxx/protocol/saml/descriptor",
      },
      idp4: {
        category: "idp4",
        idpMetaUrl: "https://deptva.idp4preview.com/app/yyyy/sso/saml/metadata",
      },
    },
  },
};
describe("selectPassportStrategyKey", () => {
  test("selectPassportStrategyKey idp1", () => {
    mockReq.body = { SAMLResponse: dataFromFile("idp1_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp1");
  });
  test("selectPassportStrategyKey idp2", () => {
    mockReq.body = { SAMLResponse: dataFromFile("idp2_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp2");
  });

  test("selectPassportStrategyKey idp3", () => {
    mockReq.body = { SAMLResponse: dataFromFile("idp3_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp3");
  });

  test("selectPassportStrategyKey idp4", () => {
    mockReq.body = { SAMLResponse: dataFromFile("idp4_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp4");
  });

  test("selectPassportStrategyKey default 'idp1'", () => {
    mockReq.body = {
      SAMLResponse: dataFromFile("unmatched_example.xml.b64"),
    };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp1");
  });
});
