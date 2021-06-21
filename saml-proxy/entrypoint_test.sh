#!/usr/bin/env bash
# Team Pivot!

usage() {
cat <<EOF
Runs saml proxy's regression tests.

docker run \
  --rm vasdvp/lighthouse-saml-proxy-tests \
  --saml-proxy-url=$SAML_PROXY_URL \
  --client-id=$CLIENT_ID \
  --idp=$IDP 
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
esac
done

npm test