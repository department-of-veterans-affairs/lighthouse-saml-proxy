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
      dynamo_table_name: {
        description: "DEPRECATED - name of request table",
        required: true,
      },
      dynamo_oauth_requests_table: {
        description: "name of request table (supersedes dynamo_table_name)",
        required: true,
      },
      dynamo_launch_context_table: {
        description: "name of launch context table.",
        required: true,
      },
      dynamo_clients_table: {
        description: "name of clients table.",
        required: true,
        default: "Clients",
      },
      dynamo_static_token_table: {
        description: "name of static token table.",
        required: true,
        default: "StaticTokens",
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
      validate_post_endpoint: {
        description: "va.gov token validation endpoint",
        required: true,
        default: "https://sandbox-api.va.gov/internal/auth/v1/validation",
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
      enable_smart_launch_service: {
        description: "Enable SMART launch lookup service?",
        required: false,
        default: false,
      },
      enable_static_token_service: {
        description: "Enable static token lookup service?",
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
          manage_endpoint: {
            description:
              "URL where an end-user can view which applications currently have access to data and can make adjustments to these access rights",
            required: false,
            default: null,
          },
          enable_consent_endpoint: {
            description: "Enable consent to Grants endpoint?",
            required: false,
            default: false,
          },
          client_store: {
            description:
              "Indicates if client information is to be retrieved locally from the dynamo instance, ie. set to 'local' if the app category requires the client information to be retrieved from a dynamo lookup",
            required: false,
            default: null,
          },
          opaque_token: {
            description:
              "Indicates if the issued token will be opaque and therefore need extra handling.",
            required: false,
            default: false,
          },
          custom_metadata: {
            description:
              "An object of endpoints that can be used to override the default metadata.",
            required: false,
            authorization_endpoint: {
              description:
                "URL where the application will make the authorization request.",
              required: false,
              default: null,
            },
            token_endpoint: {
              description:
                "URL where the application will make the token request.",
              required: false,
              default: null,
            },
            userinfo_endpoint: {
              description:
                "URL where the application will make the user info request.",
              required: false,
              default: null,
            },
            introspection_endpoint: {
              description:
                "URL where the application will make the introspection request.",
              required: false,
              default: null,
            },
            revocation_endpoint: {
              description:
                "URL where the application will make the token revokation request.",
              required: false,
              default: null,
            },
            jwks_uri: {
              description:
                "URL where the application will make the jwks request.",
              required: false,
              default: null,
            },
            issuer: {
              description: "URL of the token issuer.",
              required: false,
              default: null,
            },
          },
          idp: {
            description:
              "Default Okta IDP for this authz server (overrides global default)",
            required: false,
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
          smart_launch: {
            description: "The path component for the SMART launch service",
            required: true,
            default: "/smart/launch",
          },
        },
      },
      idps: {
        description: "Enabled identity providers",
        required: false,
        type: "array",
        slug: {
          description:
            "A URL friendly descriptor consistent across all environments",
          required: true,
        },
        id: {
          description: "The identity provider ID",
          required: true,
        },
      },
    })
    .wrap(yargs.terminalWidth()).argv;
}

module.exports = {
  processArgs,
};
