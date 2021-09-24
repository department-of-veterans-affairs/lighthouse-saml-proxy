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
