#!/usr/bin/env bash
# Team Pivot!

usage() {
cat <<EOF
Runs saml proxy's regression tests.

docker run \
  --rm vasdvp/lighthouse-saml-proxy-tests \
  --saml-proxy-url=$SAML_PROXY_URL \
  --client-id=$CLIENT_ID \
  --idp=$IDP \
  --authorization-url=$AUTHORIZATION_URL \
  --user-password=$USER_PASSWORD \
  --valid-user=$VALID_USER_EMAIL \
  --icn-error-password=$ICN_ERROR_PASSWORD \
  --icn-error-user=$ICN_ERROR_USER_EMAIL

EOF
}

if [ $# -eq 0 ]; then
  usage
  exit 1
fi

export HEADLESS=1

for i in "$@"
do
case $i in
    --help|-h)
      usage; exit 1 ;;
    --saml-proxy-url=*)
      export SAML_PROXY_URL="${i#*=}"; shift ;;
    --client-id=*)
      export CLIENT_ID="${i#*=}"; shift ;;
    --idp=*)
      export IDP="${i#*=}"; shift ;;
    --authorization-url=*)
      export AUTHORIZATION_URL="${i#*=}"; shift ;;
    --user-password=*)
      export USER_PASSWORD="${i#*=}"; shift ;;
    --valid-user=*)
      export VALID_USER_EMAIL="${i#*=}"; shift ;;
    --icn-error-user=*)
      export ICN_ERROR_USER_EMAIL="${i#*=}"; shift ;;
    --icn-error-password=*)
      export ICN_ERROR_PASSWORD="${i#*=}"; shift ;;
esac
done

npm test