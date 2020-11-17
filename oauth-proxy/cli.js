const yargs = require("yargs");

function processArgs() {
  return yargs
    .usage("Proxy for OpenId Connect Server")
    .env()
    .config()
    .options({
      port: {
        description: "Port for Proxy to list",
        required: true,
        default: 7100,
      },
      host: {
        description:
          "host of oauth-proxy in the form of protocol://domain:port",
        required: true,
      },
      upstream_issuer: {
        description:
          "URI of upstream issuer to the proxy. Eventually, this field will go away in favor is the isolated issuers based on API category",
        required: true,
      },
      upstream_issuer_timeout_ms: {
        description: "Optional timeout (ms) for upstream requests",
        required: false,
      },
      aws_secret: {
        description: "AWS Secret Access Key",
        required: false,
        default: null,
      },
      aws_id: {
        description: "AWS Access ID",
        required: false,
        default: null,
      },
      aws_region: {
        description: "AWS Region",
        required: true,
        default: "us-west-2",
      },
      dynamo_local: {
        description: "flag to use local DynamoDB instance",
        required: false,
      },
      dynamo_client_credentials_table: {
        description: "name of client credentials table.",
        required: true,
      },
      hmac_secret: {
        description:
          "hmac secret to hash access tokens being stored in client credentials table.",
        required: true,
      },
      okta_url: {
        description: "base URL of okta organization",
        required: true,
      },
      okta_token: {
        description: "okta API token",
        required: true,
      },
      validate_endpoint: {
        description: "va.gov token validation endpoint",
        required: true,
        default: "https://sandbox-api.va.gov/internal/auth/v0/validation",
      },
      validate_post_endpoint: {
        description: "va.gov token validation endpoint",
        required: false,
      },
      manage_endpoint: {
        description:
          "URL where an end-user can view which applications currently have access to data and can make adjustments to these access rights",
        required: false,
        default: "https://staging.va.gov/account",
      },
      validate_apiKey: {
        description: "apiKey permitting access to validate endpoint",
      },
      idp: {
        description:
          "Okta IDP identifier to be added as a query param (idp) if not specified by user in authorize request",
      },
      sentry_dsn: {
        description: "URL of the sentry project to send errors",
        required: false,
        string: true,
      },
      sentry_environment: {
        description: "Environment of the Sentry project",
        required: false,
        string: true,
      },
      enable_pkce_authorization_flow: {
        description: "Enable PKCE authorization flow?",
        required: false,
        default: true,
      },
      enable_okta_consent_endpoint: {
        description: "Enable Delete Grants endpoint (Okta Consent)?",
        required: false,
        default: false,
      },
      routes: {
        description:
          "An object that describes route configurations for isolated api categories",
        required: false,
        categories: {
          type: "array",
          description:
            "An array of objects that describe the api-category endpoint path suffix as well as the upstream issuer for the respective api category",
          required: true,
          api_category: {
            description:
              "A string that represents both the api category and an endpoint path addition, eg: '/veteran-verification-apis/v1'",
            required: true,
          },
          upstream_issuer: {
            description: "URI of upstream issuer to be proxies",
            required: true,
          },
        },
        app_routes: {
          description:
            "Represents a route to the respective okta server route as well as a path to the endpoint. eg: '/authorization'",
          required: true,
          string: true,
          authorize: {
            description: "The path component for the authorization endpoint",
            required: true,
            default: "/authorization",
          },
          token: {
            description: "The path component for the token endpoint",
            required: true,
            default: "/token",
          },
          userinfo: {
            description: "The path component for the userinfo endpoint",
            required: true,
            default: "/userinfo",
          },
          introspection: {
            description: "The path component for the introspection endpoint",
            required: true,
            default: "/introspect",
          },
          manage: {
            description: "The path component for the manage endpoint",
            required: true,
            default: "/manage",
          },
          revoke: {
            description: "The path component for the revoke endpoint",
            required: true,
            default: "/revoke",
          },
          jwks: {
            description: "The path component for the jwks endpoint",
            required: true,
            default: "/keys",
          },
          grants: {
            description: "The path component for the grants endpoint",
            required: true,
            default: "/grants",
          },
        },
      },
    })
    .wrap(yargs.terminalWidth()).argv;
}

module.exports = {
  processArgs,
};
