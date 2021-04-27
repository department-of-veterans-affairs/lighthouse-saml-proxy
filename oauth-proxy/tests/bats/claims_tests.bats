#!/usr/bin/env bats

usage() {
cat <<EOF
Tests the oauth-proxy claims endpoint.

Example
  HOST="https://sandbox-api.va.gov/oauth2" TOKEN_FILE={ Token File } bats ./claims_tests.bats
EOF
}

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

setup() {
  if [ -z "$HOST" ]; then
    echo "ERROR HOST is a required parameter."
    usage
    exit 0
  fi
  curl_status="$(mktemp)"
  curl_body="$(mktemp)"
}

teardown() {
  rm $curl_status
  rm $curl_body
}

@test 'Claims missing token' {
  do_claims
  cat "$curl_status"
  [ "$(cat "$curl_status")" -eq 400 ]
}

@test 'Claims invalid token' {
  do_claims abc
  [ "$(cat "$curl_status")" -eq 403 ]
}

@test 'Claims valid token' {
  do_claims $(cat "$TOKEN_FILE" | jq .access_token | tr -d '"')
  cat "$curl_status"
  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq 'has("iss")')" == "true" ]
}