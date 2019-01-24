# SAML/OAuth Proxies

## SAML Proxy

The SAML Proxy sits between Okta and the ID.me SAML IDP. The proxy is used to intercept ID.me IDP assertions
and ensure that the user has Level-of-Assurance 3 (aka LOA3). The LOA3 users are redirected onto Okta to have
their user record established/updated. The non-LOA3 users are given an error page that sends them back to
ID.me to go through further identity verification steps.

### Running Locally

While you're developing the SAML proxy you will likely want to run it locally. It's possible to do this but,
since your local instance of the proxy will have to interact with ID.me and an Okta instance, you'll need to
configure it as if it were running in a deployed environment.

To begin, you'll want to create a file named `dev-config.json`. That file should contain a JSON object
containing fields that correspond to the options documented by the `--help` option. Once you've created that
config file you can run `npm run-script dev-start` in order to run the proxy with your code changes.

If you're a VA developer looking for the specific values to use for the dev environment, see the documentation
in the [vets-contrib](https://github.com/department-of-veterans-affairs/vets-contrib/tree/master/Developer%20Process/SAML%20Proxy)


## OAuth Proxy

The OAuth proxy sits between client applications (run by API consumers) and our Okta deployment. It implements
the SMART on FHIR spec, which is an OAuth overlay. This involves tracking a state value for the user across
sessions, so that initial auth flows and refresh auth flows send the same state to the client application.

