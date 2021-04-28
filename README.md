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
config file you can run `npm run-script start-dev` in order to run the proxy with your code changes.

If you're a VA developer looking for the specific values to use for the dev environment, a functional dev-config file can be found in the [saml-proxy-configs](https://github.com/department-of-veterans-affairs/lighthouse-saml-proxy-configs) repository.


## OAuth Proxy

The OAuth proxy sits between client applications (run by API consumers) and our Okta deployment. It implements
the SMART on FHIR spec, which is an OAuth overlay. This involves tracking a state value for the user across
sessions, so that initial auth flows and refresh auth flows send the same state to the client application.

### Running locally

The OAuth proxy also requires configuration to run locally. It is tied tightly with Okta and you'll need 
to have access to an okta authorization server and an api key for the server. 

To being you'll want to create a `dev-config.json` in the oauth-proxy subdirectory. That file should contain a 
JSON object containing fields that corresponesd to the options document by the `--help` option. Once you've
created that config you can run `npm start` to run the OAuth proxy with the code changes. 

If you're a VA developer, you can look at the [vets-contrib](https://github.com/department-of-veterans-affairs/vets-contrib/blob/master/practice-areas/engineering/Developer%20Process/SAML%20Proxy/OAuthSetup.md) repo for specific values for using our dev Okta environment.

You'll also want to setup a local instance of DynamoDB either by running `docker-compose` to start the proxy or 
by downloading and running it following [Amazon's instructions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html).


### git-secrets
git-secrets must be installed and configured to scan for AWS entries and the patterns in
[.git-secrets-patterns](.git-secrets-patterns). Exclusions are managed in
[.gitallowed](.gitallowed).
The [init-git-secrets.sh](common/scripts/init-git-secrets.sh) script can be used to simply set up.
