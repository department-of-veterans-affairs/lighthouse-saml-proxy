import { SP_ERROR_URL, SP_SLO_URL } from "./routes/constants";
import { removeHeaders, getReqUrl } from "./utils";

import process from "process";
import path from "path";
let ejs = require("ejs");

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
    this.providerName = argv.spProviderName;
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
    this.spEncryptionCert = argv.spEncryptionCert || argv.spCert;
    this.spEncryptionKey = argv.spEncryptionKey || argv.spKey;
    this.httpsPrivateKey = argv.spHttpsPrivateKey;
    this.httpsCert = argv.spHttpsCert;
    this.https = argv.spHttps;
    this.relayState = argv.spRelayState;
    this.failureRedirect = SP_ERROR_URL;
    this.failureFlash = true;
    this.category = argv.category || "id_me";
    this.signupLinkEnabled = argv.spIdpSignupLinkEnabled;
    this.dsLogonEnabled = argv.dsLogonEnabled ?? true;
    this.mhvLogonEnabled = argv.mhvLogonEnabled ?? true;
  }

  getMetadataParams(req) {
    return {
      protocol: this.protocol,
      entityID: this.audience,
      realm: this.audience,
      cert: removeHeaders(this.spCert),
      encryptionCert: removeHeaders(this.spEncryptionCert),
      acsUrls: [getReqUrl(req, req.requestAcsUrl)],
      sloUrl: getReqUrl(req, SP_SLO_URL),
      nameIDFormat: this.nameIDFormat,
    };
  }

  getRequestSecurityTokenParams(wreply, wctx) {
    return {
      wreply: wreply,
      wctx: wctx || this.relayState,
    };
  }

  getAuthnRequestParams(acsUrl, forceAuthn, relayState, authnContext, id) {
    let requestTemplate;
    ejs.renderFile(
      path.join(process.cwd(), "./views/xml_template/authnrequest.ejs"),
      {
        ForceAuthn: forceAuthn,
        NameIDFormat: this.requestNameIDFormat,
        AuthnContext: this.requestAuthnContext,
      },
      undefined,
      (err, str) => (requestTemplate = str)
    );
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
        ID: id,
        NameIDFormat: this.nameIDFormat,
      },
      requestTemplate: requestTemplate,
      signatureAlgorithm: this.signatureAlgorithm,
      digestAlgorithm: this.digestAlgorithm,
      deflate: this.deflate,
      RelayState: relayState || this.relayState,
      failureRedirect: this.failureRedirect,
      failureFlash: this.failureFlash,
    };

    if (this.signAuthnRequests) {
      params.signingKey = {
        cert: this.spCert,
        key: this.spKey,
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
      identityProviderUrl: this.idpSsoUrl, //wsfed
      recipientUrl: destinationUrl,
      destinationUrl: destinationUrl,
      protocolBinding: this.idpSsoBinding,
      decryptionKey: this.spEncryptionKey,
      checkResponseID: true,
      checkDestination: true,
      checkInResponseTo: true,
      checkExpiration: true,
      checkAudience: true,
      checkNameQualifier: true,
      checkSPNameQualifier: true,
      failureRedirect: this.failureRedirect,
      failureFlash: this.failureFlash,
      category: this.category,
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
      cert: this.spCert,
    };
  }
}
