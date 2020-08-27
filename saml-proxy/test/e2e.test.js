require("jest");

import request from "request-promise-native";
import { getSamlResponse } from "samlp";
import { DOMParser } from "xmldom";

import { buildBackgroundServerModule } from "../../common/backgroundServer";
import { getTestExpressApp, idpConfig } from "./testServer";
import { MHV_USER, DSLOGON_USER, IDME_USER, getUser } from "./testUsers";
import MockVetsApiClient from "./mockVetsApiClient";

const {
  startServerInBackground,
  stopBackgroundServer,
} = buildBackgroundServerModule("saml-proxy test app");

const loaRedirect =
  "Found. Redirecting to /samlproxy/sp/verify?authnContext=http%3A%2F%2Fidmanagement.gov%2Fns%2Fassurance%2Floa%2F3";
const userNotFoundText =
  "We need to verify your identity before giving you access to your information";

const ERROR = "error";
const LOA_REDIRECT = "loa_redirect";
const USER_NOT_FOUND = "user_not_found";
const SAML_RESPONSE = "saml_response";
const UNKNOWN = "unknown";

// Setting the mimetype when parsing html prevents the parser from complaining
// about unclosed <input> tags (side note didn't know the closing slash is optional,
// http://w3c.github.io/html-reference/syntax.html#void-elements)
const MIME_HTML = "text/html";
const PORT = 1111;
const vetsApiClient = new MockVetsApiClient();

function buildSamlResponse(type, level_of_assurance) {
  const user = getUser(type, level_of_assurance);
  return new Promise((resolve, _) => {
    getSamlResponse(idpConfig, user, (_, samlResponse) => {
      resolve(btoa(samlResponse));
    });
  });
}

function ssoRequest(samlResponse, state = "state") {
  const reqOpts = {
    method: "POST",
    resolveWithFullResponse: true,
    simple: false,
    uri: `http://localhost:${PORT}/samlproxy/sp/saml/sso`,
    form: {
      SAMLResponse: samlResponse,
      RelayState: state,
    },
  };

  return request(reqOpts);
}

// These are the HTML parsers. The SSO endpoint renders HTML/javascript that automatically
// submits a form of the SAMLResponse and RelayState back to Okta. It doesn't simply redirect
// because it would need to do a 307 redirect to stay a POST. The user would need to "approve"
// this redirect (see https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html). The `samlp`
// library we use allows the form template to be specified via config. We define the template
// to use in in the function `responseHandler` in  `src/IDPConfig`. See `src/views/samlresponse.hbs`
// for the html we are parsing. We decided to get the SAMLResponse and RelayState by parsing the
// resulting HTML instead of mocking out the response handler. Parsing the HTML keeps the
// functionality of these tests closer to what users actually experience.
function stateFromHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, MIME_HTML);
  const inputs = parsed.getElementsByTagName("input");
  return elementValue(inputs, "RelayState");
}

function SAMLResponseFromHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, MIME_HTML);
  const inputs = parsed.getElementsByTagName("input");
  return elementValue(inputs, "SAMLResponse");
}

// This function looks for the userNotFoundText in `src/views/icnError.hbs`
function isUserNotFound(body) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(body, MIME_HTML);
  const h3s = parsed.getElementsByTagName("h3");
  for (const h3 of h3s) {
    if (h3.textContent.trim() === userNotFoundText) {
      return true;
    }
  }
  return false;
}

function elementValue(elements, name) {
  for (const element of elements) {
    if (element.getAttributeNode("name").nodeValue === name) {
      return element.getAttributeNode("value").value;
    }
  }
}

// These are the SAMLResponse parsers. See `./SAMLResponse.example.xml` in the current dir (test)
// for an example of the xml document we are parsing
function assertionValueFromSAMLResponse(samlResponse, assertion) {
  const element = findAssertionInSamlResponse(samlResponse, assertion);
  if (!element) {
    return;
  }
  return element.textContent;
}

function findAssertionInSamlResponse(samlResponse, assertion) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(samlResponse);
  const elements = parsed.getElementsByTagName("saml:Attribute");
  for (const element of elements) {
    for (const attribute of element.attributes) {
      if (attribute.nodeValue === assertion) {
        return element;
      }
    }
  }
}

function isBodySamlResponse(body) {
  const parser = new DOMParser();
  try {
    const samlResponse = atob(SAMLResponseFromHtml(body));
    const parsed = parser.parseFromString(samlResponse);
    const found = parsed.getElementsByTagName("samlp:Response");
    return found.length > 0;
  } catch {
    return false;
  }
}

function responseResultType(response) {
  const status = response.statusCode;
  const body = response.body;

  if (status >= 500) {
    return ERROR;
  }

  if (status === 302 && body === loaRedirect) {
    return LOA_REDIRECT;
  }

  if (isUserNotFound(body)) {
    return USER_NOT_FOUND;
  }

  if (isBodySamlResponse(body)) {
    return SAML_RESPONSE;
  }

  return UNKNOWN;
}

describe("Logins for idp", () => {
  beforeAll(() => {
    const app = getTestExpressApp(vetsApiClient);
    startServerInBackground(app, PORT);
  });

  afterAll(() => {
    stopBackgroundServer();
  });

  beforeEach(() => {
    vetsApiClient.reset();
  });

  it("uses the RelayState from the request", async () => {
    const expectedState = "expectedState";
    const requestSamlResponse = await buildSamlResponse(IDME_USER, "3");
    vetsApiClient.findUserInMVI = true;
    const response = await ssoRequest(requestSamlResponse, expectedState);

    expect(responseResultType(response)).toEqual(SAML_RESPONSE);
    const responseSamlResponse = SAMLResponseFromHtml(response.body);
    const state = stateFromHtml(response.body);

    // make sure we've actually updated the saml response
    expect(responseSamlResponse).not.toEqual(requestSamlResponse);
    expect(state).toEqual(expectedState);
  });

  for (const idp of [IDME_USER, MHV_USER, DSLOGON_USER]) {
    describe(idp, () => {
      it("redirects to the verify identity page the if user is not loa3 verified", async () => {
        const requestSamlResponse = await buildSamlResponse(idp, "2");
        vetsApiClient.findUserInMVI = true;
        const response = await ssoRequest(requestSamlResponse);
        expect(responseResultType(response)).toEqual(LOA_REDIRECT);
      });

      it("looks up the user from mvi, responding with their ICN in the SAMLResponse", async () => {
        const requestSamlResponse = await buildSamlResponse(idp, "3");
        vetsApiClient.findUserInMVI = true;
        const response = await ssoRequest(requestSamlResponse);

        expect(responseResultType(response)).toEqual(SAML_RESPONSE);

        const responseSamlResponse = atob(SAMLResponseFromHtml(response.body));
        const icn = assertionValueFromSAMLResponse(responseSamlResponse, "icn");
        expect(icn).toEqual("123");
      });

      it("treats the user as a VSO if the lookup from mvi fails", async () => {
        const requestSamlResponse = await buildSamlResponse(idp, "3");
        vetsApiClient.findUserInMVI = false;
        vetsApiClient.userIsVSO = true;
        const response = await ssoRequest(requestSamlResponse);

        expect(responseResultType(response)).toEqual(SAML_RESPONSE);

        const responseSamlResponse = atob(SAMLResponseFromHtml(response.body));
        const icn = assertionValueFromSAMLResponse(responseSamlResponse, "icn");
        expect(icn).toBeUndefined();
      });

      it("returns a user not found page when the user is not found in mvi or is not a VSO", async () => {
        const requestSamlResponse = await buildSamlResponse(idp, "3");
        vetsApiClient.findUserInMVI = false;
        vetsApiClient.userIsVSO = false;
        const response = await ssoRequest(requestSamlResponse);
        expect(responseResultType(response)).toEqual(USER_NOT_FOUND);
      });
    });
  }
});
