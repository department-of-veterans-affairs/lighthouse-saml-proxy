import {
  IDP_SSO,
  IDP_METADATA,
  SP_METADATA_URL,
  SP_VERIFY,
  SP_ERROR_URL,
  SP_FAILURE_TO_PROOF,
} from "./constants";

import {
  acsFactory,
  parseSamlRequest,
  handleError,
  samlLogin,
} from "./handlers";

import fs from "fs";
import process from "process";
import path from "path";
import template from "lodash.template";
import samlp from "samlp";

const METADATA_TEMPLATE = template(
  fs.readFileSync(path.join(process.cwd(), "./templates/metadata.tpl"), "utf8")
);

export default function addRoutes(
  app,
  idpConfig,
  spConfigs,
  acsUrl,
  cache,
  cacheEnabled,
  idpSelectionRefactor
) {
  let idpSelection = idpSelectionRefactor
    ? "login_selection_refactor"
    : "login_selection";
  app.get(["/", "/idp", IDP_SSO], parseSamlRequest, samlLogin(idpSelection));
  app.post(["/", "/idp", IDP_SSO], parseSamlRequest, samlLogin(idpSelection));

  app.get(IDP_METADATA, function (req, res, next) {
    samlp.metadata(req.idp.options)(req, res);
  });

  app.get(SP_METADATA_URL, function (req, res, next) {
    const xml = METADATA_TEMPLATE(spConfigs.id_me.getMetadataParams(req));
    res.set("Content-Type", "text/xml");
    res.send(xml);
  });

  app.get(SP_VERIFY, parseSamlRequest, samlLogin("verify"));

  app.get(SP_FAILURE_TO_PROOF, parseSamlRequest, samlLogin("failureToProof"));

  acsFactory(app, acsUrl, cache, cacheEnabled);

  app.get(SP_ERROR_URL, handleError);

  return app;
}
