/* eslint-disable jsdoc/require-returns */
import "jest";
import { selectPassportStrategyKey } from "./passport";
const fs = require("fs");
const path = require("path");

const mockReq = {
  headers: {
    origin: "http://login.example1.com",
  },
  sps: {
    options: {
      idp1: {
        category: "idp1",
        spIdpMetaUrl: "https://api.idmelabs.com/saml/metadata/provider",
      },
      idp2: {
        category: "idp2",
        spIdpMetaUrl:
          "https://idp.int.identitysandbox.gov/api/saml/metadata2023",
      },
      idp3: {
        category: "idp3",
        spIdpMetaUrl:
          "http://localhost:9080/realms/mockidp/protocol/saml/descriptor",
      },
      idp4: {
        category: "idp4",
        spIdpMetaUrl:
          "https://deptva.oktapreview.com/app/exk9rdi3kczXMv1tB1d7/sso/saml/metadata",
      },
    },
  },
};
describe("selectPassportStrategyKey", () => {
  test("selectPassportStrategyKey idp1", () => {
    mockReq.body = { SAMLResponse: samlResponse("idme_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp1");
  });
  test("selectPassportStrategyKey idp2", () => {
    mockReq.body = { SAMLResponse: samlResponse("logingov_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp2");
  });

  test("selectPassportStrategyKey idp3", () => {
    mockReq.body = { SAMLResponse: samlResponse("keycloak_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp3");
  });

  test("selectPassportStrategyKey idp4", () => {
    mockReq.body = { SAMLResponse: samlResponse("okta_example.xml.b64") };
    expect(selectPassportStrategyKey(mockReq)).toBe("idp4");
  });

  // test("selectPassportStrategyKey default 'id_me'", () => {
  //   mockReq.headers.origin = "http://login.example0.com";
  //   expect(selectPassportStrategyKey(mockReq)).toBe("id_me");
  // });
});

/**
 *
 * @param {*} fname The file with test data
 */
function samlResponse(fname) {
  const file = path.join("./test/samlResponses", fname);
  const b64data = fs.readFileSync(file, "utf8", function (err, data) {
    return data;
  });
  return b64data;
}
