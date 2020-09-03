import {
  IDP_SSO,
  IDP_METADATA,
  SP_METADATA_URL,
  SP_VERIFY,
  SP_ERROR_URL,
  IDP_SIGN_IN,
} from "./constants";

import {
  acsFactory,
  parseSamlRequest,
  handleError,
  samlLogin,
  idpSignIn,
} from "./handlers";

import fs from "fs";
import process from "process";
import path from "path";
import template from "lodash.template";
import samlp from "samlp";

const METADATA_TEMPLATE = template(
  fs.readFileSync(path.join(process.cwd(), "./templates/metadata.tpl"), "utf8")
);

export default function addRoutes(app, idpConfig, spConfig) {
  app.get(
    ["/", "/idp", IDP_SSO],
    parseSamlRequest,
    samlLogin("login_selection")
  );
  app.post(
    ["/", "/idp", IDP_SSO],
    parseSamlRequest,
    samlLogin("login_selection")
  );

  app.post(IDP_SIGN_IN, idpSignIn);

  app.get(IDP_METADATA, function (req, res, next) {
    samlp.metadata(req.idp.options)(req, res);
  });

  app.get(SP_METADATA_URL, function (req, res, next) {
    const xml = METADATA_TEMPLATE(spConfig.getMetadataParams(req));
    res.set("Content-Type", "text/xml");
    res.send(xml);
  });

  app.get(SP_VERIFY, parseSamlRequest, samlLogin("verify"));

  spConfig.acsUrls.forEach((url) => acsFactory(app, url));

  app.get(SP_ERROR_URL, handleError);

  return app;
}
