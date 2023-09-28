import btoa from "btoa";
import { getSamlResponse } from "samlp";
import { getUser } from "./testUsers";
const fs = require("fs");
const path = require("path");

/**
 * This test function builds the saml response function using session index
 * and making a call to buildSamlResponse which returns the saml response with
 * config and user parameters.
 *
 * @param {*} sessionIndex saml session index
 * @returns {*} returns the saml response using config (sessionIndex) and user info
 */
export function buildSamlResponseFunction(sessionIndex) {
  return function buildSamlResponse(type, level_of_assurance, config) {
    const user = getUser(type, level_of_assurance);
    config.inResponseTo = Math.floor(Math.random() * Date.now());
    config.sessionIndex = sessionIndex;
    sessionIndex++;
    return new Promise((resolve) => {
      getSamlResponse(config, user, (_, samlResponse) => {
        resolve(btoa(samlResponse));
      });
    });
  };
}

const strategies = new Map();
strategies.set("id_me", {
  getResponseParams: jest.fn(() => {}),
});
export let defaultMockRequest = {
  method: "GET",
  query: {
    relayState: "relay",
  },
  body: {
    RelayState: "relay",
    SAMLResponse: null
  },
  sps: {
    options: {
      id_me: {
        getResponseParams: jest.fn(() => {}),
        idpSsoUrl: "https://idp.example.com/saml/sso",
        idpMetaUrl: "https://api.idmelabs.com/metadata",
      },
    },
  },
  idp: {
    options: {},
  },
  user: {
    authnContext: {
      authnMethod: null,
    },
  },

  strategies: strategies,
  get: function (prop) {
    switch (prop) {
      case "host":
        return this.host;
      case "x-forwarded-host":
        return this.x_fowarded_host;
      default:
        return "unexpected";
    }
  },
  host: "example.com",
  originalUrl: "http://original.example.com",
  x_fowarded_host: "fowarded.example.com",
};

/**
 * Loads test data into a string.
 *
 * @param {*} fname The file with test data
 */
export function dataFromFile(fname) {
  const file = path.join("./test/samlResponses/decoded", fname);
  const samlResponse = fs.readFileSync(file, "utf8", function (err, data) {
    return data;
  });
  const encoded = Buffer.from(samlResponse, "ascii").toString("base64");
  return encoded;
}
