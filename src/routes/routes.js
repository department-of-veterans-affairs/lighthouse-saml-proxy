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

import samlp from "samlp";

export default function addRoutes(
  app,
  idpConfig,
  spConfigs,
  acsUrl,
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
    res.set("Content-Type", "text/xml");
    res.render("metadata", spConfigs.id_me.getMetadataParams(req));
  });

  app.get(SP_VERIFY, parseSamlRequest, samlLogin("verify"));

  app.get(SP_FAILURE_TO_PROOF, parseSamlRequest, samlLogin("failure_to_proof"));

  acsFactory(app, acsUrl, cache, cacheEnabled);

  app.get(SP_ERROR_URL, handleError);

  return app;
}
