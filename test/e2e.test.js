require("jest");

import axios from "axios";
import querystring from "querystring";
import { DOMParser } from "@xmldom/xmldom";
import { buildSamlResponseFunction } from "./testUtils";
import { buildBackgroundServerModule } from "./backgroundServer";
import { getTestExpressApp } from "./testServer";
import { idpConfig } from "./testServer";
import { MHV_USER, DSLOGON_USER, IDME_USER } from "./testUsers";
import MockVetsApiClient from "./mockVetsApiClient";
import { idpBadCert, idpBadKey } from "./testCerts";
import atob from "atob";
import zlib from "zlib";
const {
  startServerInBackground,
  stopBackgroundServer,
} = buildBackgroundServerModule("saml-proxy test app");

const loaRedirect =
  "Found. Redirecting to /samlproxy/sp/verify?authnContext=http%3A%2F%2Fidmanagement.gov%2Fns%2Fassurance%2Floa%2F3&RelayState=state";
const userNotFoundText =
  "We need to verify your identity before giving you access to your information";

const ERROR = "error";
const LOA_REDIRECT = "loa_redirect";
const USER_NOT_FOUND = "user_not_found";
const SAML_RESPONSE = "saml_response";
const UNKNOWN = "unknown";
const SP_ERROR = "Found. Redirecting to /samlproxy/sp/error";

// Setting the mimetype when parsing html prevents the parser from complaining
// about unclosed <input> tags (side note didn't know the closing slash is optional,
// http://w3c.github.io/html-reference/syntax.html#void-elements)
const MIME_HTML = "text/html";
const PORT = 1111;
const vetsApiClient = new MockVetsApiClient();

let sessionIndex = 1;
let buildSamlResponse = buildSamlResponseFunction(sessionIndex);

function ssoRequest(samlResponse, state = "state") {
  const payload = querystring.stringify({
    SAMLResponse: samlResponse,
    RelayState: state,
  });
  const reqOpts = {
    method: "POST",
    uri: `http://localhost:${PORT}/samlproxy/sp/saml/sso`,
    data: payload,
  };

  return axios(reqOpts);
}

async function ssoIdpRequest() {
  const reqOpts = {
    method: "POST",
    resolveWithFullResponse: true,
    uri: `http://localhost:${PORT}/samlproxy/idp/saml/sso`,
    form: {
      SAMLRequest:
        "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c2FtbDJwOkF1dGhuUmVxdWVzdCBBc3NlcnRpb25Db25zdW1lclNlcnZpY2VVUkw9Imh0dHBzOi8vZGVwdHZhLWV2YWwub2t0YS5jb20vc3NvL3NhbWwyLzBvYTM3eDJjd2Y5eU90cUdiMnA3IiBEZXN0aW5hdGlvbj0iaHR0cDovL2xvY2FsaG9zdDo3MDAwL3NzbyIgRm9yY2VBdXRobj0iZmFsc2UiIElEPSJpZDE4MjMzNTA2MjM0MTUxMDQxMjAwMjE5OTMwNCIgSXNzdWVJbnN0YW50PSIyMDIxLTAyLTA5VDE5OjA4OjE2LjMzNFoiIFZlcnNpb249IjIuMCIgeG1sbnM6c2FtbDJwPSJ1cm46b2FzaXM6bmFtZXM6dGM6U0FNTDoyLjA6cHJvdG9jb2wiPjxzYW1sMjpJc3N1ZXIgeG1sbnM6c2FtbDI9InVybjpvYXNpczpuYW1lczp0YzpTQU1MOjIuMDphc3NlcnRpb24iPmh0dHBzOi8vd3d3Lm9rdGEuY29tL3NhbWwyL3NlcnZpY2UtcHJvdmlkZXIvc3BheXF6dHB4eWZqa2V1bnhvYnc8L3NhbWwyOklzc3Vlcj48ZHM6U2lnbmF0dXJlIHhtbG5zOmRzPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwLzA5L3htbGRzaWcjIj48ZHM6U2lnbmVkSW5mbz48ZHM6Q2Fub25pY2FsaXphdGlvbk1ldGhvZCBBbGdvcml0aG09Imh0dHA6Ly93d3cudzMub3JnLzIwMDEvMTAveG1sLWV4Yy1jMTRuIyIvPjxkczpTaWduYXR1cmVNZXRob2QgQWxnb3JpdGhtPSJodHRwOi8vd3d3LnczLm9yZy8yMDAxLzA0L3htbGRzaWctbW9yZSNyc2Etc2hhMjU2Ii8+PGRzOlJlZmVyZW5jZSBVUkk9IiNpZDE4MjMzNTA2MjM0MTUxMDQxMjAwMjE5OTMwNCI+PGRzOlRyYW5zZm9ybXM+PGRzOlRyYW5zZm9ybSBBbGdvcml0aG09Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvMDkveG1sZHNpZyNlbnZlbG9wZWQtc2lnbmF0dXJlIi8+PGRzOlRyYW5zZm9ybSBBbGdvcml0aG09Imh0dHA6Ly93d3cudzMub3JnLzIwMDEvMTAveG1sLWV4Yy1jMTRuIyIvPjwvZHM6VHJhbnNmb3Jtcz48ZHM6RGlnZXN0TWV0aG9kIEFsZ29yaXRobT0iaHR0cDovL3d3dy53My5vcmcvMjAwMC8wOS94bWxkc2lnI3NoYTEiLz48ZHM6RGlnZXN0VmFsdWU+RER2UVB5UkxLdFZCSkV4VzZCc2tsTTJjYStvPTwvZHM6RGlnZXN0VmFsdWU+PC9kczpSZWZlcmVuY2U+PC9kczpTaWduZWRJbmZvPjxkczpTaWduYXR1cmVWYWx1ZT5EbUpKclVKenZWNDBUYkJ0VzJHOWN6Z1F5T1BmTVcxYlpWN0czTHpRTmNHeDIyVy9lRnpkVjJocFo5eC9hSkRKRjM4S3Y2UnVOT3NtUWprTDVLQlNBSm1aZVlPNTEzcDJFcGFzWnQwRkhXRUlFWlFOcU9KTmh6OXdDRDBUbjRnMGhPSUVNaHRCVVU2aDd5ZlJlenRkamtteWYrUzEyWVY5UytIM3J3eXlFR2lSQWhQNWpsd2ZUNkpBS3liOUgzUk5QZ0Z0MWU2MWM5MXNDc01qRlhORy9TRWdZOEVENmplbTRibUE1Y0VjeDlYRlNLZEt0MjJxVkJZRlNJTzZ5SGE5M3BmTlZ3K2ZEdTZnbkQvS2lFT21HeGxQK2lrZjVBVnhHd3gvY1BuTFBBYStwaFloYnViazNjU0dLbU9Zb0ZYeU50MlVMTmZKWUZwZU1xVVlzTnNON3c9PTwvZHM6U2lnbmF0dXJlVmFsdWU+PGRzOktleUluZm8+PGRzOlg1MDlEYXRhPjxkczpYNTA5Q2VydGlmaWNhdGU+TUlJRHRqQ0NBcDZnQXdJQkFnSUdBV1BaK3IvSE1BMEdDU3FHU0liM0RRRUJDd1VBTUlHYk1Rc3dDUVlEVlFRR0V3SlZVekVUTUJFRwpBMVVFQ0F3S1EyRnNhV1p2Y201cFlURVdNQlFHQTFVRUJ3d05VMkZ1SUVaeVlXNWphWE5qYnpFTk1Bc0dBMVVFQ2d3RVQydDBZVEVVCk1CSUdBMVVFQ3d3TFUxTlBVSEp2ZG1sa1pYSXhIREFhQmdOVkJBTU1FMlJsY0hSMllTMTJaWFJ6WjI5MkxXVjJZV3d4SERBYUJna3EKaGtpRzl3MEJDUUVXRFdsdVptOUFiMnQwWVM1amIyMHdIaGNOTVRnd05qQTNNVEV5TURFNVdoY05Namd3TmpBM01URXlNVEU0V2pDQgptekVMTUFrR0ExVUVCaE1DVlZNeEV6QVJCZ05WQkFnTUNrTmhiR2xtYjNKdWFXRXhGakFVQmdOVkJBY01EVk5oYmlCR2NtRnVZMmx6ClkyOHhEVEFMQmdOVkJBb01CRTlyZEdFeEZEQVNCZ05WQkFzTUMxTlRUMUJ5YjNacFpHVnlNUnd3R2dZRFZRUUREQk5rWlhCMGRtRXQKZG1WMGMyZHZkaTFsZG1Gc01Sd3dHZ1lKS29aSWh2Y05BUWtCRmcxcGJtWnZRRzlyZEdFdVkyOXRNSUlCSWpBTkJna3Foa2lHOXcwQgpBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFsYm52czYwN2thOEN2ekRFS0RIUFJWN1hvd2o4SkUveVN2RmtKRENGaWZjZ28wMlIvTEE3CkM5RHVLN20vS0l2dU9WakRWZ0JaVUlWeHNGeFQvRnBsc2ZEcDJDK3FJbVFmKzRvb0p1dTZhci9xTW9JZmRUbEN1TjRjV2F4L0cxWGQKMFFNOFpqSjVEbVJWcW1aNk91NTFld29jYWlrS20yS2E2dmhQTUdPVGdUa3V2YnJBRXRTczdMcFRoWjJydHRsb044ZkJsSk1yOFFidAp0YjNFaEV1cWtVRExjNEJkTVYxenRzcFlTbDhIZ1NlLy9tS2JVazNkcldMRFhZZU02YXdRWk9NTzFJVzJpTnpHQk5UcjBqWDBPVXNoCjRjczgvRXpHaFFsbGlYU0hmZHNrTEpGSjMycjVmM1BmdTc5Sks3ZGdUd3c1SkZWeG9OWjJkZUEwenhnU2FRSURBUUFCTUEwR0NTcUcKU0liM0RRRUJDd1VBQTRJQkFRQVpJL1dpSUpON2FScXRWaXd6S2ZXTHYvbWF0dzMrdXFFWjdBU0dDZXZPV2tEdnhFMk9qME5RZllHbgpRZllOYkszR1I5bWtUdjVyOTE1aE41SmJKTERFVTZLcVZzdzlFRW5GZ1RTd1NOd014NnY5Q3craEdFS3dTbURzbnoxaXgzUjJ6Q2lWCmZtd3NzeUpiRlRiQk9PeW5NZE43RTVpWnBwZ21IejBuZThkbE15NEh0bm05WnNCN001ejJyaU9QUUxCUzVXSHFPeVlyTDNHOHhNT0wKVkMvK2hycWNDRVRsUDZtei9iWjhsa28xZFFpcm9NU1ROQ0U5UEtpQ3V2bk9IZWxndm9NMmR4RmE1SUc5eVBlNlA4NGFHS0FBb0hjbQpkS2NOY0NjRnluOXJpRW14WWZVbnZLdllzbGw2MGY0dkZIblJ3L1RzbGIwcXZqVXBZQlNBUWhhSjwvZHM6WDUwOUNlcnRpZmljYXRlPjwvZHM6WDUwOURhdGE+PC9kczpLZXlJbmZvPjwvZHM6U2lnbmF0dXJlPjxzYW1sMnA6TmFtZUlEUG9saWN5IEZvcm1hdD0idXJuOm9hc2lzOm5hbWVzOnRjOlNBTUw6MS4xOm5hbWVpZC1mb3JtYXQ6dW5zcGVjaWZpZWQiLz48L3NhbWwycDpBdXRoblJlcXVlc3Q+",
      RelayState: "state",
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

  if (status === 302 && body === SP_ERROR) {
    return SP_ERROR;
  }

  if (isUserNotFound(body)) {
    return USER_NOT_FOUND;
  }

  if (isBodySamlResponse(body)) {
    return SAML_RESPONSE;
  }

  return UNKNOWN;
}

function decode_saml_uri(saml) {
  var uriDecoded = decodeURIComponent(saml);
  var b64decoded = new Buffer.from(uriDecoded, "base64");
  return zlib.inflateRawSync(b64decoded).toString();
}

function getIdpSamlRequest(response, class_tags) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(response.body, MIME_HTML);
  const url = parsed
    .getElementsByClassName(class_tags)
    ["0"].getAttributeNode("href").nodeValue;
  return decode_saml_uri(new URL(url).searchParams.get("SAMLRequest"));
}

function getIdFromSamlRequest(request) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(request);
  return parsed.documentElement.getAttributeNode("ID").nodeValue;
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

  it("Saml Request check for Request IDs", async () => {
    let response = await ssoIdpRequest();
    let dsLogonRequest = getIdpSamlRequest(
      response,
      "no-external-icon usa-button dslogon"
    );
    let dsLogonId = getIdFromSamlRequest(dsLogonRequest);
    expect(dsLogonId).toBeTruthy;
    let myHealtheVetRequest = getIdpSamlRequest(
      response,
      "no-external-icon usa-button mhv"
    );
    let myHealtheVetID = getIdFromSamlRequest(myHealtheVetRequest);
    expect(myHealtheVetID).toBeTruthy;
    let idMeRequest = getIdpSamlRequest(
      response,
      "no-external-icon usa-button idme-signin"
    );
    let idMeID = getIdFromSamlRequest(idMeRequest);
    expect(idMeID).toBeTruthy;
    expect(dsLogonId).toEqual(myHealtheVetID);
    expect(dsLogonId).toEqual(idMeID);
    expect(dsLogonId).not.toEqual("@@ID@@");
  });

  it("uses the RelayState from the request", async () => {
    const expectedState = "expectedState";
    const requestSamlResponse = await buildSamlResponse(
      IDME_USER,
      "3",
      idpConfig
    );
    vetsApiClient.findUserInMVI = true;
    const response = await ssoRequest(requestSamlResponse, expectedState);

    expect(responseResultType(response)).toEqual(SAML_RESPONSE);
    const responseSamlResponse = SAMLResponseFromHtml(response.body);
    const state = stateFromHtml(response.body);

    // make sure we've actually updated the saml response
    expect(responseSamlResponse).not.toEqual(requestSamlResponse);
    expect(state).toEqual(expectedState);
  });

  it("Rejects invalid signature", async () => {
    const expectedState = "expectedState";
    let config = { ...idpConfig };
    config.cert = idpBadCert;
    config.key = Buffer.from(idpBadKey, "utf-8");
    const requestSamlResponse = await buildSamlResponse(IDME_USER, "3", config);
    vetsApiClient.findUserInMVI = true;
    const response = await ssoRequest(requestSamlResponse, expectedState);

    expect(responseResultType(response)).toEqual(SP_ERROR);
  });

  for (const idp of [IDME_USER, MHV_USER, DSLOGON_USER]) {
    describe(idp, () => {
      it("redirects to the verify identity page the if user is not loa3 verified", async () => {
        const requestSamlResponse = await buildSamlResponse(
          idp,
          "2",
          idpConfig
        );
        vetsApiClient.findUserInMVI = true;
        const response = await ssoRequest(requestSamlResponse);
        expect(responseResultType(response)).toEqual(LOA_REDIRECT);
      });

      it("looks up the user from mvi, responding with their ICN in the SAMLResponse", async () => {
        const requestSamlResponse = await buildSamlResponse(
          idp,
          "3",
          idpConfig
        );
        vetsApiClient.findUserInMVI = true;
        const response = await ssoRequest(requestSamlResponse);

        expect(responseResultType(response)).toEqual(SAML_RESPONSE);

        const responseSamlResponse = atob(SAMLResponseFromHtml(response.body));
        const icn = assertionValueFromSAMLResponse(responseSamlResponse, "icn");
        expect(icn).toEqual("123");
      });

      it("treats the user as a VSO if the lookup from mvi fails", async () => {
        const requestSamlResponse = await buildSamlResponse(
          idp,
          "3",
          idpConfig
        );
        vetsApiClient.findUserInMVI = false;
        vetsApiClient.userIsVSO = true;
        const response = await ssoRequest(requestSamlResponse);

        expect(responseResultType(response)).toEqual(SAML_RESPONSE);

        const responseSamlResponse = atob(SAMLResponseFromHtml(response.body));
        const icn = assertionValueFromSAMLResponse(responseSamlResponse, "icn");
        expect(icn).toBeUndefined();
      });

      it("returns a user not found page when the user is not found in mvi or is not a VSO", async () => {
        const requestSamlResponse = await buildSamlResponse(
          idp,
          "3",
          idpConfig
        );
        vetsApiClient.findUserInMVI = false;
        vetsApiClient.userIsVSO = false;
        const response = await ssoRequest(requestSamlResponse);
        expect(responseResultType(response)).toEqual(USER_NOT_FOUND);
      });
    });
  }
});
