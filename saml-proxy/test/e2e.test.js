require('jest');

import request from 'request-promise-native';
import { getSamlResponse } from 'samlp';
import { DOMParser } from 'xmldom';

import { buildBackgroundServerModule } from '../../common/backgroundServer';
import { getApp, idpConfig } from './testServer';

const { startServerInBackground, stopBackgroundServer } = buildBackgroundServerModule("saml-proxy test app");

const loaRedirect = 'Found. Redirecting to /samlproxy/sp/verify?authnContext=http%3A%2F%2Fidmanagement.gov%2Fns%2Fassurance%2Floa%2F3';
const userNotFoundText = 'We need to verify your identity before giving you access to your information';

const ERROR = 'error';
const LOA_REDIRECT = 'loa_redirect';
const USER_NOT_FOUND = 'user_not_found';
const SAML_RESPONSE = 'saml_response';
const UNKNOWN = 'unknown';

// Setting the mimetype when parsing html prevents the parser from complaining
// about unclosed <input> tags (side note didn't know the closing slash is optional,
// http://w3c.github.io/html-reference/syntax.html#void-elements)
const MIME_HTML = 'text/html';
const PORT = 1111;

function buildSamlResponse(firstname, level_of_assurance) {
  const user = {
    issuer: 'test',
    userName: 'ae9ff5f4e4b741389904087d94cd19b2',
    nameIdFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    claims: {
      birth_date: '1967-06-19',
      email: 'va.api.user+idme.001@gmail.com',
      fname: firstname,
      social: '123456789',
      gender: 'female',
      lname: 'ELLIS',
      level_of_assurance: level_of_assurance,
      mname: 'E',
      multifactor: 'true',
      uuid: 'ae9ff5f4e4b741389904087d94cd19b2'
    }
  };

  return new Promise((resolve, _) => {
    getSamlResponse(idpConfig, user, (_, samlResponse) => {
      resolve(btoa(samlResponse));
    });
  });
}

function ssoRequest(samlResponse, state = 'state') {
  const reqOpts = {
    method: 'POST',
    resolveWithFullResponse: true,
    simple: false,
    uri: `http://localhost:${PORT}/samlproxy/sp/saml/sso`,
    form: {
      SAMLResponse: samlResponse,
      RelayState: state,
    }
  };

  return request(reqOpts);
}

// These are the HTML parsers. See https://github.com/auth0/node-samlp/blob/master/templates/form.ejs
// for the html document being parsed
function stateFromHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, MIME_HTML);
  const inputs = parsed.getElementsByTagName('input');
  return elementValue(inputs, 'RelayState');
}

function SAMLResponseFromHtml(html) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, MIME_HTML);
  const inputs = parsed.getElementsByTagName('input');
  return elementValue(inputs, 'SAMLResponse');
}

// This function looks for the userNotFoundText in src/views/icnError.hbs
function isUserNotFound(body) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(body, MIME_HTML);
  const h3s = parsed.getElementsByTagName('h3');
  for(const h3 of h3s) {
    if(h3.textContent.trim() === userNotFoundText) {
      return true;
    }
  }
  return false;
}

function elementValue(elements, name) {
  for(const element of elements) {
    if(element.getAttributeNode('name').nodeValue === name) {
      return element.getAttributeNode('value').value;
    }
  }
}

// These are the SAMLResponse parsers. See SAMLResponse.example.xml in the current dir (test)
// for an example of the xml document we are parsing
function assertionValueFromSAMLResponse(samlResponse, assertion) {
  const element = findAssertionInSamlResponse(samlResponse, assertion);
  if(!element) {
    return;
  }
  return element.textContent;
}

function findAssertionInSamlResponse(samlResponse, assertion) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(samlResponse);
  const elements = parsed.getElementsByTagName('saml:Attribute');
  for(const element of elements) {
    for(const attribute of element.attributes) {
      if(attribute.nodeValue === assertion) {
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
    const found = parsed.getElementsByTagName('samlp:Response');
    return found.length > 0;
  } catch {
    return false
  }
}

function responseResultType(response) {
  const status = response.statusCode;
  const body = response.body;

  if(status >= 500) {
    return ERROR;
  }

  if(status === 302 && body === loaRedirect) {
    return LOA_REDIRECT;
  }

  if(isUserNotFound(body)) {
    return USER_NOT_FOUND;
  }

  if(isBodySamlResponse(body)) {
    return SAML_RESPONSE;
  }

  return UNKNOWN;
}

describe('Logins for idp', () => {
  beforeAll(() => {
    const app = getApp();
    startServerInBackground(app, PORT);
  });

  afterAll(() => {
    stopBackgroundServer();
  });

  it('uses the RelayState from the request', async () => {
    const expectedState = 'expectedState';
    const requestSamlResponse = await buildSamlResponse('mvi', '3');
    const response = await ssoRequest(requestSamlResponse, expectedState);

    expect(responseResultType(response)).toEqual(SAML_RESPONSE);
    const responseSamlResponse = SAMLResponseFromHtml(response.body);
    const state = stateFromHtml(response.body);

    // make sure we've actually updated the saml response
    expect(responseSamlResponse).not.toEqual(requestSamlResponse);
    expect(state).toEqual(expectedState);
  });

  describe('idme', () => {
    it('redirects to the verify identity page the if user is not loa3 verified', async () => {
      const requestSamlResponse = await buildSamlResponse('mvi', '2');
      const response = await ssoRequest(requestSamlResponse);
      expect(responseResultType(response)).toEqual(LOA_REDIRECT);
    });

    it('looks up the user from mvi, responding with their ICN in the SAMLResponse', async () => {
      const requestSamlResponse = await buildSamlResponse('mvi', '3');
      const response = await ssoRequest(requestSamlResponse);

      expect(responseResultType(response)).toEqual(SAML_RESPONSE);

      const responseSamlResponse = atob(SAMLResponseFromHtml(response.body));
      const icn = assertionValueFromSAMLResponse(responseSamlResponse, 'icn');
      expect(icn).toEqual('123');
    });

    it('looks up user from vso if the lookup from mvi fails', async () => {
      const requestSamlResponse = await buildSamlResponse('vso', '3');
      const response = await ssoRequest(requestSamlResponse);

      expect(responseResultType(response)).toEqual(SAML_RESPONSE);

      const responseSamlResponse = atob(SAMLResponseFromHtml(response.body));
      const icn = assertionValueFromSAMLResponse(responseSamlResponse, 'icn');
      expect(icn).toBeUndefined();
    });

    it('returns a user not found page when the user is not found in mvi or vso', async () => {
      const requestSamlResponse = await buildSamlResponse('user', '3');
      const response = await ssoRequest(requestSamlResponse);
      expect(responseResultType(response)).toEqual(USER_NOT_FOUND);
    });
  });

  // describe.skip('dslogin', () => {
  //   it('properly redirects if user is not loa3', () => {

  //   });

  //   it('properly looks up user from mvi', () => {

  //   });

  //   it('properly looks up user from vso', () => {

  //   });

  //   it('properly handles user not found in mvi or vso', () => {

  //   });
  // });

  // describe.skip('mhv', () => {
  //   it('properly redirects if user is not loa3', () => {

  //   });

  //   it('properly looks up user from mvi', () => {

  //   });

  //   it('properly looks up user from vso', () => {

  //   });

  //   it('properly handles user not found in mvi or vso', () => {

  //   });
  // });
});
