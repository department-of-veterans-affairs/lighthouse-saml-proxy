#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

pass=1
curl_status="$(mktemp)"
curl_body="$(mktemp)"

usage() {
cat <<EOF
Tests the oauth-proxy claims endpoint.

Example
  ./claims_tests.sh --host=https://sandbox-api.va.gov/oauth2
EOF
exit 1
}

for i in "$@"; do
  case $i in
    --host=*)
      HOST="${i#*=}"; shift ;;
    --help|-h)
      usage ;  exit 1 ;;
    --) shift ; break ;;
    *) usage ; exit 1 ;;
  esac
done

if [ -z "$HOST" ]; then
  echo "ERROR --host is a required parameter."
  exit 1
fi

source "$DIR"/token_utils.sh

# Helper Functions

track_result() {
  if [[ "$?" -gt 0 ]]
  then
    pass=0
  fi
}

# --------

# Oauth Proxy Functions

do_claims() {
  local token="$1"

  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "token=$token" \
    -d "client_id=$client_id" \
    -d "client_secret=$client_secret" \
    "$HOST/claims" > "$curl_status"
}

echo -e "\nClaims Tests"

echo -e "\tRunning ... Claims missing token"

do_claims
"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result

echo -e "\tRunning ... Claims invalid token"

do_claims abc
"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=403
track_result

echo -e "\tRunning ... Claims valid token"
token=$(get_access_token)
do_claims $token
"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="iss"
track_result

if [[ $pass -lt 1 ]];
then
  echo -e "\tFAIL - Some claims tests did not pass."
  exit 1
fi

exit 0
