import { IDP_SSO,
         IDP_SLO,
         IDP_SIGN_IN,
         IDP_METADATA,
         SP_METADATA_URL,
         IDP_SIGN_OUT } from "./constants";

import { acsFactory,
         parseSamlRequest,
         parseLogoutRequest,
         idpSignIn,
         idpSignOut } from "./handlers";

import fs from "fs";
import process from "process";
import path from "path";
import template from "lodash.template";
import samlp from "samlp";

const METADATA_TEMPLATE = template(
  fs.readFileSync(path.join(process.cwd(), './templates/metadata.tpl'), 'utf8')
);

export default function addRoutes(app, idpConfig, spConfig) {
  app.get(['/', '/idp', IDP_SSO], parseSamlRequest);
  app.post(['/', '/idp', IDP_SSO], parseSamlRequest);

  app.get(IDP_SLO, parseLogoutRequest);
  app.post(IDP_SLO, parseLogoutRequest);

  app.post(IDP_SIGN_IN, idpSignIn);

  app.get(IDP_METADATA, function(req, res, next) {
    samlp.metadata(req.idp.options)(req, res);
  });

  app.get(SP_METADATA_URL, function(req, res, next) {
    const xml = METADATA_TEMPLATE(spConfig.getMetadataParams(req));
    console.log(xml);
    res.set('Content-Type', 'text/xml');
    res.send(xml);
  });

  spConfig.acsUrls.forEach((url) => acsFactory(app, url));

  app.get(IDP_SIGN_OUT, idpSignOut);

  return app;
}
