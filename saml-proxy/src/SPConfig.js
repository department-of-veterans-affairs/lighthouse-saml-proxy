import { SP_ERROR_URL, SP_SLO_URL } from "./routes/constants";
import { removeHeaders, getReqUrl } from "./utils";

import fs from "fs";
import process from "process";
import path from "path";
import template from "lodash.template";

const AUTHN_REQUEST_TEMPLATE = template(
  fs.readFileSync(path.join(process.cwd(), './templates/authnrequest.tpl'), 'utf8')
);

export default class SPConfig {
  constructor(argv) {
    this.port = argv.spPort;
    this.protocol = argv.spProtocol;
    this.idpIssuer = argv.spIdpIssuer;
    this.idpSsoUrl = argv.spIdpSsoUrl;
    this.idpSsoBinding = argv.spIdpSsoBinding;
    this.idpSloUrl = argv.spIdpSloUrl;
    this.idpSloBinding = argv.spIdpSloBinding;
    this.idpCert = argv.spIdpCert;
    this.idpThumbprint = argv.spIdpThumbprint;
    this.idpMetaUrl = argv.spIdpMetaUrl;
    this.audience = argv.spAudience;
    this.providerName = argv.spProviderName,
    this.acsUrls = argv.spAcsUrls;
    this.signAuthnRequests = argv.spSignAuthnRequests;
    this.signatureAlgorithm = argv.spSignatureAlgorithm;
    this.digestAlgorithm = argv.spDigestAlgorithm;
    this.requestNameIDFormat = argv.spRequestNameIDFormat;
    this.validateNameIDFormat = argv.spValidateNameIDFormat;
    this.nameIDFormat = argv.spNameIDFormat;
    this.requestAuthnContext = argv.spRequestAuthnContext;
    this.authnContextClassRef = argv.spAuthnContextClassRef;
    this.spCert = argv.spCert;
    this.spKey = argv.spKey;
    this.httpsPrivateKey = argv.spHttpsPrivateKey;
    this.httpsCert = argv.spHttpsCert;
    this.https = argv.spHttps;
    this.relayState = argv.spRelayState;

    this.requestAcsUrl = argv.spAcsUrls[0];
    this.failureRedirect = SP_ERROR_URL;
    this.failureFlash = true;
  }

  getMetadataParams(req) {
    return {
      protocol: this.protocol,
      entityID: this.audience,
      realm: this.audience,
      cert: removeHeaders(this.spCert),
      acsUrls: this.acsUrls.map(url => getReqUrl(req, url)),
      sloUrl: getReqUrl(req, SP_SLO_URL),
      nameIDFormat: this.nameIDFormat
    };
  }

  getRequestSecurityTokenParams(wreply, wctx) {
    return {
      wreply: wreply,
      wctx: wctx || this.relayState
    };
  }

  getAuthnRequestParams(acsUrl, forceAuthn, relayState, authnContext) {
    const params = {
      protocol: this.protocol,
      realm: this.audience,
      callback: acsUrl,
      protocolBinding: this.idpSsoBinding,
      identityProviderUrl: this.idpSsoUrl,
      providerName: this.providerName,
      forceAuthn: forceAuthn,
      authnContext: authnContext || this.authnContextClassRef,
      requestContext: {
        NameIDFormat: this.nameIDFormat
      },
      requestTemplate: AUTHN_REQUEST_TEMPLATE({
        ForceAuthn: forceAuthn,
        NameIDFormat: this.requestNameIDFormat,
        AuthnContext: this.requestAuthnContext
      }),
      signatureAlgorithm: this.signatureAlgorithm,
      digestAlgorithm: this.digestAlgorithm,
      deflate: this.deflate,
      RelayState: relayState || this.relayState,
      failureRedirect: this.failureRedirect,
      failureFlash: this.failureFlash
    };

    if (this.signAuthnRequests) {
      params.signingKey = {
        cert: this.spCert,
        key: this.spKey
      };
    }
    return params;
  }

  getResponseParams(destinationUrl) {
    return {
      protocol: this.protocol,
      thumbprint: this.idpThumbprint,
      cert: removeHeaders(this.idpCert),
      realm: this.audience,
      identityProviderUrl: this.idpSsoUrl,  //wsfed
      recipientUrl: destinationUrl,
      destinationUrl: destinationUrl,
      protocolBinding: this.idpSsoBinding,
      decryptionKey: this.spKey,
      checkResponseID: true,
      checkDestination: true,
      checkInResponseTo: true,
      checkExpiration: true,
      checkAudience: true,
      checkNameQualifier: true,
      checkSPNameQualifier: true,
      failureRedirect: this.failureRedirect,
      failureFlash: this.failureFlash
    };
  }

  getLogoutParams() {
    return {
      issuer: this.audience,
      protocolBinding: this.idpSloBinding,
      deflate: this.deflate,
      identityProviderUrl: this.idpSloUrl,
      identityProviderSigningCert: this.idpCert,
      key: this.spKey,
      cert: this.spCert
    };
  }
}
