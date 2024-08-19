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
  --valid-login-gov-user-email=$VALID_LOGIN_GOV_USER_EMAIL \
  --valid-login-gov-user-seed=$VALID_LOGIN_GOV_USER_SEED \
  --login-gov-user-password=$LOGIN_GOV_USER_PASSWORD \
  --icn-error-login-gov-user-email=$ICN_ERROR_LOGIN_GOV_USER_EMAIL \
  --icn-error-login-gov-user-seed=$ICN_ERROR_LOGIN_GOV_USER_SEED

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
    --valid-login-gov-user-email=*)
      export VALID_LOGIN_GOV_USER_EMAIL="${i#*=}"; shift ;;
    --valid-login-gov-user-seed=*)
      export VALID_LOGIN_GOV_USER_SEED="${i#*=}"; shift ;;
    --login-gov-user-password=*)
      export LOGIN_GOV_USER_PASSWORD="${i#*=}"; shift ;;
    --icn-error-login-gov-user-email=*)
      export ICN_ERROR_LOGIN_GOV_USER_EMAIL="${i#*=}"; shift ;;
    --icn-error-login-gov-user-seed=*)
      export ICN_ERROR_LOGIN_GOV_USER_SEED="${i#*=}"; shift ;;
esac
done

npm test