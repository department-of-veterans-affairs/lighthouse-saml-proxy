# SAML Proxy

The SAML Proxy sits between Okta and the ID.me SAML IDP. The proxy is used to intercept ID.me IDP assertions
and ensure that the user has Level-of-Assurance 3 (aka LOA3). The LOA3 users are redirected onto Okta to have
their user record established/updated. The non-LOA3 users are given an error page that sends them back to
ID.me to go through further identity verification steps.

## Running Locally

Test (ci/cd)

While you're developing the SAML proxy you will likely want to run it locally. It's possible to do this but,
since your local instance of the proxy will have to interact with ID.me and an Okta instance, you'll need to
configure it as if it were running in a deployed environment.

To begin, you'll want to create a file named `dev-config.json`. That file should contain a JSON object
containing fields that correspond to the options documented by the `--help` option. Once you've created that
config file you can run `npm run-script start-dev` in order to run the proxy with your code changes.

If you're a VA developer looking for the specific values to use for the dev environment, a functional dev-config file can be found in the [saml-proxy-configs](https://github.com/department-of-veterans-affairs/lighthouse-saml-proxy-configs) repository. Fields with the `FIX_ME` value will need to be replaced with real values.

## git-secrets
git-secrets must be installed and configured to scan for AWS entries and the patterns in
[.git-secrets-patterns](.git-secrets-patterns). Exclusions are managed in
[.gitallowed](.gitallowed).
The [init-git-secrets.sh](common/scripts/init-git-secrets.sh) script can be used to simply set up.
