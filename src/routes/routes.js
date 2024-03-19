import {
  IDP_SSO,
  IDP_METADATA,
  SP_METADATA_URL,
  SP_VERIFY,
  SP_ERROR_URL,
  SP_FAILURE_TO_PROOF,
  SAMLPRXOY_PATH,
  IDP_PATH,
} from "./constants";

import {
  acsFactory,
  parseSamlRequest,
  handleError,
  samlLogin,
} from "./handlers";

import samlp from "samlp";
/**
 * Function for adding routes
 *
 * @param {*} app param app
 * @param {*} idpConfigs user open id configs
 * @param {*} spConfigs user service provider configs
 * @param {*} acsUrl assertion consumer service url
 * @param {*} cache redis cache
 * @param {*} cacheEnabled boolean param used for redis cache
 * @returns {*} returns the app after the saml request is being process to be able to
 * log in after using idp sso, then gets idp metadata, metadata url and verifies the request.
 * If not verified it will return an error.
 */
export default function addRoutes(
  app,
  idpConfigs,
  spConfigs,
  acsUrl,
  cache,
  cacheEnabled
) {
  Object.entries(idpConfigs).forEach((idpEntry) => {
    var ipdPath = SAMLPRXOY_PATH + "/" + idpEntry[0] + IDP_PATH;
    var idpMetadataPath = SAMLPRXOY_PATH + "/" + idpEntry[0] + "/idp/metadata";
    if (idpEntry[0] == "default") {
      ipdPath = IDP_SSO;
      idpMetadataPath = IDP_METADATA;
    }
    app.get(
      ["/", "/idp", ipdPath],
      parseSamlRequest,
      samlLogin("login_selection")
    );
    app.post(
      ["/", "/idp", ipdPath],
      parseSamlRequest,
      samlLogin("login_selection")
    );
    app.get(idpMetadataPath, function (req, res, next) {
      samlp.metadata(idpEntry[1])(req, res);
    });
  });

  app.get(SP_METADATA_URL, function (req, res, next) {
    res.set("Content-Type", "text/xml");
    res.render("xml_template/metadata", spConfigs.id_me.getMetadataParams(req));
  });

  app.get(SP_VERIFY, parseSamlRequest, samlLogin("verify"));

  app.get(SP_FAILURE_TO_PROOF, parseSamlRequest, samlLogin("failure_to_proof"));

  acsFactory(app, acsUrl, cache, cacheEnabled);

  app.get(SP_ERROR_URL, handleError);

  return app;
}
