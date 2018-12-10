import SimpleProfileMapper from "./simpleProfileMapper";
import { IDP_SSO } from "./routes/constants";
import { DOMParser } from "xmldom";
import { IdPOptions, DigestAlgorithmType, SignatureAlgorithmType } from "samlp"
import { Response, Request, NextFunction } from "express"

interface IdPRequest extends Request {
  authnRequest?: {
    acsUrl?: string
  }
}

export default class IDPConfig implements IdPOptions {
  idpBaseUrl: string;
  issuer: string;
  serviceProviderId: string;
  cert: string;
  key: string;
  audience: string;
  recipient: string;
  destination: string;
  acsUrl: string;
  sloUrl: string;
  RelayState: string;
  allowRequestAcsUrl: boolean;
  digestAlgorithm: DigestAlgorithmType;
  signatureAlgorithm: SignatureAlgorithmType;
  signResponse: boolean;
  encryptAssertion: boolean;
  encryptionCert: string;
  encryptionPublicKey: string;
  encryptionAlgorithm: string;
  keyEncryptionAlgorithm: string;
  lifetimeInSeconds: number;
  authnContextClassRef: string;
  authnContextDecl: string;
  includeAttributeNameFormat: boolean;
  profileMapper: any;
  postEndpointPath: string;
  redirectEndpointPath: string;
  logoutEndpointPaths: {
    redirect?: string
    post?: string
  }

  constructor(argv : any) {
    SimpleProfileMapper.prototype.metadata = argv.idpConfig.metadata;

    this.idpBaseUrl = argv.idpBaseUrl;
    this.issuer = argv.idpIssuer;
    this.serviceProviderId = argv.idpServiceProviderId || argv.idpAudience;
    this.cert = argv.idpCert;
    this.key = argv.idpKey;
    this.audience = argv.idpAudience;
    this.recipient = argv.idpAcsUrl;
    this.destination = argv.idpAcsUrl;
    this.acsUrl = argv.idpAcsUrl;
    this.sloUrl = argv.idpSloUrl;
    this.RelayState = argv.idpRelayState;
    this.allowRequestAcsUrl = !argv.idpDisableRequestAcsUrl;
    this.digestAlgorithm = 'sha256';
    this.signatureAlgorithm = 'rsa-sha256';
    this.signResponse = argv.idpSignResponse;
    this.encryptAssertion = argv.idpEncryptAssertion;
    this.encryptionCert = argv.idpEncryptionCert;
    this.encryptionPublicKey = argv.idpEncryptionPublicKey;
    this.encryptionAlgorithm = 'http://www.w3.org/2001/04/xmlenc#aes256-cbc';
    this.keyEncryptionAlgorithm = 'http://www.w3.org/2001/04/xmlenc#rsa-oaep-mgf1p';
    this.lifetimeInSeconds = 3600;
    this.authnContextClassRef = argv.idpAuthnContextClassRef;
    this.authnContextDecl = argv.idpAuthnContextDecl;
    this.includeAttributeNameFormat = true;
    this.profileMapper = SimpleProfileMapper;
    this.postEndpointPath = IDP_SSO;
    this.redirectEndpointPath = IDP_SSO;
    this.logoutEndpointPaths = {};
  }

  public getUserFromRequest(req : Request) {
    return req.user;
  }

  public getPostURL(audience : string, authnRequestDom : any, req : IdPRequest, callback : (err: any, url: string) => void) {
    callback(null, (req.authnRequest && req.authnRequest.acsUrl) ? req.authnRequest.acsUrl : this.acsUrl);
  }

  public transformAssertion(assertionDom : any) {
    if (this.authnContextDecl) {
      var declDoc;
      try {
        declDoc = new DOMParser().parseFromString(this.authnContextDecl);
      } catch(err){
        console.log('Unable to parse Authentication Context Declaration XML', err);
      }
      if (declDoc) {
        const authnContextDeclEl = assertionDom.createElementNS('urn:oasis:names:tc:SAML:2.0:assertion', 'saml:AuthnContextDecl');
        authnContextDeclEl.appendChild(declDoc.documentElement);
        const authnContextEl = assertionDom.getElementsByTagName('saml:AuthnContext')[0];
        authnContextEl.appendChild(authnContextDeclEl);
      }
    }
  }

  public responseHandler(response : any, opts : any, req : Request, res : Response, next : NextFunction) {
    res.render('samlresponse', {
      AcsUrl: opts.postUrl,
      SAMLResponse: response.toString('base64'),
      RelayState: opts.RelayState
    });
  }
}
