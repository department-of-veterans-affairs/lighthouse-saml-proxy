import {
  IDP_SSO,
  IDP_METADATA,
  SP_METADATA_URL,
  SP_VERIFY,
  SP_ERROR_URL,
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

const meta_data_template_path = path.join(
  process.cwd(),
  "./templates/metadata.tpl"
);
if (meta_data_template_path.length > 4096) {
  throw new Error("Unexpected large path");
}
const METADATA_TEMPLATE = template(
  fs.readFileSync(meta_data_template_path, "utf8")
);

export default function addRoutes(
  app,
  idpConfig,
  spConfig,
  cache,
  cacheEnabled
) {
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

  app.get(IDP_METADATA, function (req, res, next) {
    samlp.metadata(req.idp.options)(req, res);
  });

  app.get(SP_METADATA_URL, function (req, res, next) {
    const xml = METADATA_TEMPLATE(spConfig.getMetadataParams(req));
    res.set("Content-Type", "text/xml");
    res.send(xml);
  });

  app.get(SP_VERIFY, parseSamlRequest, samlLogin("verify"));

  spConfig.acsUrls.forEach((url) => acsFactory(app, url, cache, cacheEnabled));

  app.get(SP_ERROR_URL, handleError);

  return app;
}
