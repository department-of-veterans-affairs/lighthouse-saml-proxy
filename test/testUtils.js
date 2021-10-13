import btoa from "btoa";
import { getSamlResponse } from "samlp";
import { idpConfig } from "./testServer";
import { getUser } from "./testUsers";

export function buildSamlResponseFunction(sessionIndex) {
  return function buildSamlResponse(type, level_of_assurance) {
    const user = getUser(type, level_of_assurance);
    let config = idpConfig;
    config.sessionIndex = sessionIndex;
    sessionIndex++;
    return new Promise((resolve) => {
      getSamlResponse(config, user, (_, samlResponse) => {
        resolve(btoa(samlResponse));
      });
    });
  };
}

export let defaultMockRequest = {
  method: "GET",
  query: {
    relayState: "relay",
  },
  body: {
    relayState: "relay",
  },
  sps: {
    options: {
      id_me: {
        getResponseParams: jest.fn(() => {}),
      },
    },
  },
  strategies: {
    id_me: {
      options: {},
    },
  },
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
