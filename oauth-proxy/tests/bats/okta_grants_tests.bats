#!/usr/bin/env bats

usage() {
cat <<EOF
Tests the Oauth Proxy's Introspect endpoint.

Example
  HOST="https://sandbox-api.va.gov/oauth2" CLIENT_ID={Client ID} USER_EMAIL={email} bats ./okta_grants_tests.bats
EOF
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

do_revoke_grant() {
  local client="$1"
  local email="$2"

  curl -X DELETE \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "$(jq \
            -scn \
            --arg client "$client" \
            --arg email "$email" \
            '{"client_id": $client, "email": $email}')" \
    "$HOST/grants" > "$curl_status"
}

@test 'Delete Okta grant happy path' {
  do_revoke_grant "$CLIENT_ID" "$USER_EMAIL"
  cat "$curl_status"
  cat "$curl_body" 
  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq .email | tr -d '"')" == "$USER_EMAIL" ]
  [ "$(cat "$curl_body" | jq .responses[0].status | tr -d '"')" == "204" ]
  [ "$(cat "$curl_body" | jq .responses[0].message | tr -d '"')" == "Okta grants successfully revoked" ]
}

@test 'Revoke Okta grants invalid email' {
  do_revoke_grant "$CLIENT_ID" "invalid"
  
  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_request" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "Invalid email address." ]
}

@test 'Revoke Okta grants invalid client' {
  do_revoke_grant "invalid" "$USER_EMAIL"
  
  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_request" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "Invalid client_id." ]
}