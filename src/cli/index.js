import yargs from "yargs";
import path from "path";
import { cwd } from "process";
import {
  makeCertFileCoercer,
  certToPEM,
  loadFileSync,
  KEY_CERT_HELP_TEXT,
} from "./coercing";
import { checkEncryptionCerts, checkWhenNoMetadata } from "./checks";
import { BINDINGS } from "../samlConstants";
/**
 * This function processing different arugments that launches an
 * idp web server and mints saml assertions or logout responses for
 * a service provider
 *
 * @returns {*} returns certToPEM or idp value and mints saml assertions/logout responses
 */
export function processArgs() {
  return yargs
    .usage(
      "\nSimple IdP for SAML 2.0 WebSSO & SLO Profile\n\n" +
        "Launches an IdP web server that mints SAML assertions or logout responses for a Service Provider (SP)\n\n" +
        "Usage:\n\t$0 -acs {url} -aud {uri}"
    )
    .config()
    .env()
    .options({
      port: {
        description: "IdP Web Server Listener Port",
        required: true,
        default: 7000,
      },
      idpCert: {
        description: "IdP Signature PublicKey Certificate",
        required: true,
        default: path.resolve(cwd(), "./idp-public-cert.pem"),
        coerce: makeCertFileCoercer(
          "certificate",
          "IdP Signature PublicKey Certificate",
          KEY_CERT_HELP_TEXT
        ),
      },
      fraudBlockEnabled: {
        description:
          "Enable or disable blocking logins based on the fraud identity indicator",
        required: false,
        boolean: true,
        default: false,
      },
      idpKey: {
        description: "IdP Signature PrivateKey Certificate",
        required: true,
        default: path.resolve(cwd(), "./idp-private-key.pem"),
        coerce: makeCertFileCoercer(
          "private key",
          "IdP Signature PrivateKey Certificate",
          KEY_CERT_HELP_TEXT
        ),
      },
      idpIssuer: {
        description: "IdP Issuer URI",
        required: true,
        default: "urn:example:idp",
      },
      idpAcsUrl: {
        description: "SP Assertion Consumer URL",
        required: true,
      },
      idpSloUrl: {
        description: "SP Single Logout URL",
        required: false,
      },
      idpAudience: {
        description: "SP Audience URI",
        required: true,
      },
      idpServiceProviderId: {
        description: "SP Issuer/Entity URI",
        required: false,
        string: true,
      },
      idpRelayState: {
        description: "Default SAML RelayState for SAMLResponse",
        required: false,
      },
      idpDisableRequestAcsUrl: {
        description:
          "Disables ability for SP AuthnRequest to specify Assertion Consumer URL",
        required: false,
        boolean: true,
        default: false,
      },
      idpEncryptAssertion: {
        description: "Encrypts assertion with SP Public Key",
        required: false,
        boolean: true,
        default: false,
      },
      idpEncryptionCert: {
        description: "SP Certificate (pem) for Assertion Encryption",
        required: false,
        string: true,
        coerce: makeCertFileCoercer("certificate", "Encryption cert"),
      },
      idpEncryptionPublicKey: {
        description:
          "SP RSA Public Key (pem) for Assertion Encryption " +
          "(e.g. openssl x509 -pubkey -noout -in sp-cert.pem)",
        required: false,
        string: true,
        coerce: makeCertFileCoercer("public key", "Encryption public key"),
      },
      idpHttpsPrivateKey: {
        description: "Web Server TLS/SSL Private Key (pem)",
        required: false,
        string: true,
        coerce: makeCertFileCoercer("private key"),
      },
      idpHttpsCert: {
        description: "Web Server TLS/SSL Certificate (pem)",
        required: false,
        string: true,
        coerce: makeCertFileCoercer("certificate"),
      },
      idpHttps: {
        description:
          "Enables HTTPS Listener (requires httpsPrivateKey and httpsCert)",
        required: true,
        boolean: true,
        default: false,
      },
      idpSignResponse: {
        description: "Enables signing of responses",
        required: false,
        boolean: true,
        default: true,
      },
      idpRollSession: {
        description:
          "Create a new session for every authn request instead of reusing an existing session",
        required: false,
        boolean: true,
        default: false,
      },
      idpAuthnContextClassRef: {
        description: "Authentication Context Class Reference",
        required: false,
        string: true,
        default:
          "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport",
      },
      idpAuthnContextDecl: {
        description: "Authentication Context Declaration (XML FilePath)",
        required: false,
        string: true,
        coerce: loadFileSync,
      },
      idpBaseUrl: {
        description: "IdP Base URL",
        required: false,
        string: true,
      },
      sentryDSN: {
        description: "URL of the sentry project to send errors",
        required: false,
        string: true,
      },
      sentryEnvironment: {
        description: "Environment of the Sentry project",
        required: false,
        string: true,
      },
      sessionSecret: {
        description: "Secret used to sign the session cookie",
        required: true,
        string: true,
      },
      spProtocol: {
        description: "Federation Protocol",
        required: true,
        string: true,
        default: "samlp",
      },
      spIdpIssuer: {
        description: "IdP Issuer URI",
        required: false,
        string: true,
        default: "urn:example:idp",
      },
      spIdpSsoUrl: {
        description: "IdP Single Sign-On Service URL (SSO URL)",
        required: false,
        string: true,
      },
      spIdpSsoBinding: {
        description: "IdP Single Sign-On AuthnRequest Binding",
        required: true,
        string: true,
        default: BINDINGS.REDIRECT,
      },
      spIdpSloUrl: {
        description: "IdP Single Logout Service URL (SLO URL) (SAMLP)",
        required: false,
        string: true,
      },
      spIdpSloBinding: {
        description: "IdP Single Logout Request Binding (SAMLP)",
        required: true,
        string: true,
        default: BINDINGS.REDIRECT,
      },
      spIdpCert: {
        description: "IdP Public Key Signing Certificate (PEM)",
        required: false,
        string: true,
        coerce: () => {
          return certToPEM(
            makeCertFileCoercer(
              "certificate",
              "IdP Public Key Signing Certificate (PEM)",
              KEY_CERT_HELP_TEXT
            )
          );
        },
      },
      spIdpThumbprint: {
        description: "IdP Public Key Signing Certificate SHA1 Thumbprint",
        required: false,
        string: true,
        coerce: (value) => {
          return value ? value.replace(/:/g, "") : value;
        },
      },
      spIdpMetaUrl: {
        description: "IdP SAML Metadata URL",
        required: false,
        string: true,
      },
      spIdpMetadata: {
        description: "IdP SAML Metadata URL",
        required: false,
        string: true,
      },
      spAudience: {
        description: "SP Audience URI / RP Realm",
        required: false,
        string: true,
        default: "urn:example:sp",
      },
      spProviderName: {
        description: "SP Provider Name",
        required: false,
        string: true,
        default: "Simple SAML Service Provider",
      },
      spAcsUrl: {
        description: "SP Assertion Consumer Service (ACS) URL (Relative URL)",
        required: true,
        string: true,
        default: "/samlproxy/sp/saml/sso",
      },
      spSignAuthnRequests: {
        description: "Sign AuthnRequest Messages (SAMLP)",
        required: true,
        boolean: true,
        default: true,
      },
      spSignatureAlgorithm: {
        description: "Signature Algorithm",
        required: false,
        string: true,
        default: "rsa-sha256",
      },
      spDigestAlgorithm: {
        description: "Digest Algorithm",
        required: false,
        string: true,
        default: "sha256",
      },
      spRequestNameIDFormat: {
        description: "Request Subject NameID Format (SAMLP)",
        required: false,
        boolean: true,
        default: true,
      },
      spValidateNameIDFormat: {
        description: "Validate format of Assertion Subject NameID",
        required: false,
        boolean: true,
        default: true,
      },
      spNameIDFormat: {
        description: "Assertion Subject NameID Format",
        required: false,
        string: true,
        default: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
      },
      spRequestAuthnContext: {
        description: "Request Authentication Context (SAMLP)",
        required: false,
        boolean: true,
        default: true,
      },
      spAuthnContextClassRef: {
        description: "Authentication Context Class Reference",
        required: false,
        string: true,
        default:
          "urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport",
      },
      spCert: {
        description: "SP/RP Public Key Signature Certificate (PEM)",
        string: true,
        required: false,
        default: path.resolve(cwd(), "./sp-cert.pem"),
        coerce: makeCertFileCoercer(
          "certificate",
          "SP Signing Public Key Certificate (PEM)",
          KEY_CERT_HELP_TEXT
        ),
      },
      spKey: {
        description: "SP/RP Private Key Signature Certificate(PEM)",
        string: true,
        required: false,
        default: path.resolve(cwd(), "./sp-key.pem"),
        coerce: makeCertFileCoercer(
          "private key",
          "SP Signing Private Key (PEM)",
          KEY_CERT_HELP_TEXT
        ),
      },
      spEncryptionCert: {
        description: "SP/RP Public Key Encryption Certificate (PEM)",
        string: true,
        required: false,
        coerce: makeCertFileCoercer(
          "certificate",
          "SP Encryption Public Key Certificate (PEM)",
          KEY_CERT_HELP_TEXT
        ),
      },
      spEncryptionKey: {
        description: "SP/RP Private Key Decryption Certificate(PEM)",
        string: true,
        required: false,
        coerce: makeCertFileCoercer(
          "private key",
          "SP Encryption Private Key (PEM)",
          KEY_CERT_HELP_TEXT
        ),
      },
      spHttpsPrivateKey: {
        description: "Web Server TLS/SSL Private Key (PEM)",
        required: false,
        string: true,
        coerce: makeCertFileCoercer(
          "private key",
          "Web Server TLS/SSL Private Key (PEM)",
          KEY_CERT_HELP_TEXT
        ),
      },
      spHttpsCert: {
        description: "Web Server TLS/SSL Certificate (PEM)",
        required: false,
        string: true,
        coerce: makeCertFileCoercer(
          "certificate",
          "Web Server TLS/SSL Public Key Certificate (PEM)",
          KEY_CERT_HELP_TEXT
        ),
      },
      spHttps: {
        description:
          "Enables HTTPS Listener (requires httpsPrivateKey and httpsCert)",
        required: false,
        boolean: true,
        default: false,
      },
      spRelayState: {
        description: "Default Relay State",
        required: false,
        string: true,
      },
      mpiUserEndpoint: {
        alias: "mpiUserEndpoint",
        description: "The URL to the endpont that used to perform MPI lookups.",
        required: true,
        string: true,
        default: "https://dev-api.va.gov/internal/auth/v3/mpi-user",
      },
      accessKey: {
        alias: "accessKey",
        description:
          "The access key to the endpont that used to perform MPI lookups.",
        required: false,
        string: true,
      },
      vsoUserEndpoint: {
        alias: "vsoUserEndpoint",
        description: "The URL to the endpont that used to perform VSO lookups.",
        required: true,
        string: true,
        default:
          "https://dev-api.va.gov/services/veteran/v0/representatives/find_rep",
      },
      vetsAPIToken: {
        alias: "vetsApiToken",
        description:
          "Token used to authorize calls to vets-api while performing MVI lookups.",
        required: true,
        string: true,
      },
      idpSamlLoginsEnabled: {
        description: "Flag on enabling IDP logins such as login.gov",
        requied: false,
        default: false,
      },
      idpSamlLogins: {
        description:
          "An array of objects used to describe SP IDP options for login",
        required: false,
        type: "array",
        category: {
          description:
            "SP IDP category, For instance 'login_gov' for login.gov",
          required: true,
          string: true,
        },
        spProtocol: {
          description: "Federation Protocol",
          required: true,
          string: true,
          default: "samlp",
        },
        spIdpIssuer: {
          description: "IdP Issuer URI",
          required: false,
          string: true,
          default: "urn:example:idp",
        },
        spIdpSsoUrl: {
          description: "IdP Single Sign-On Service URL (SSO URL)",
          required: false,
          string: true,
        },
        spIdpSsoBinding: {
          description: "IdP Single Sign-On AuthnRequest Binding",
          required: true,
          string: true,
          default: BINDINGS.REDIRECT,
        },
        spIdpSloUrl: {
          description: "IdP Single Logout Service URL (SLO URL) (SAMLP)",
          required: false,
          string: true,
        },
        spIdpSloBinding: {
          description: "IdP Single Logout Request Binding (SAMLP)",
          required: true,
          string: true,
          default: BINDINGS.REDIRECT,
        },
        spIdpCert: {
          description: "IdP Public Key Signing Certificate (PEM)",
          required: false,
          string: true,
          coerce: () => {
            return certToPEM(
              makeCertFileCoercer(
                "certificate",
                "IdP Public Key Signing Certificate (PEM)",
                KEY_CERT_HELP_TEXT
              )
            );
          },
        },
        spIdpThumbprint: {
          description: "IdP Public Key Signing Certificate SHA1 Thumbprint",
          required: false,
          string: true,
          coerce: (value) => {
            return value ? value.replace(/:/g, "") : value;
          },
        },
        spIdpMetaUrl: {
          description: "IdP SAML Metadata URL",
          required: false,
          string: true,
        },
        spIdpMetadata: {
          description: "IdP SAML Metadata URL",
          required: false,
          string: true,
        },
        spAudience: {
          description: "SP Audience URI / RP Realm",
          required: false,
          string: true,
          default: "urn:example:sp",
        },
        spRequestNameIDFormat: {
          description: "Request Subject NameID Format (SAMLP)",
          required: false,
          boolean: true,
          default: true,
        },
        spRequestAuthnContext: {
          description: "Request Authentication Context (SAMLP)",
          required: false,
          boolean: true,
          default: true,
        },
        spIdpSignupLinkEnabled: {
          description: "Enables a link to the Signup Page for the IDP",
          required: false,
          boolean: true,
          default: false,
        },
        dsLogonEnabled: {
          description: "Enables DS Logon signin option, enabled by default",
          required: false,
          boolean: true,
          default: true,
        },
        mhvLogonEnabled: {
          description: "Enables MHV signin option, enabled by default",
          required: false,
          boolean: true,
          default: true,
        },
      },
    })
    .example(
      "\t$0 --acs http://acme.okta.com/auth/saml20/exampleidp --aud https://www.okta.com/saml2/service-provider/spf5aFRRXFGIMAYXQPNV",
      ""
    )
    .check(checkEncryptionCerts)
    .check(checkWhenNoMetadata)
    .wrap(yargs.terminalWidth()).argv;
}

export { certToPEM };
