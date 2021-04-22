#!/usr/bin/env bats

usage() {
cat <<EOF
Tests the Oauth Proxy's Introspect endpoint.

Example
  HOST="https://sandbox-api.va.gov/oauth2" TOKEN_FILE={ Token File } EXPIRED_TOKEN_FILE={ Expired Token File } CLIENT_ID={Client ID} CLIENT_SECRET={Client Secret} bats ./introspect_tests.bats
EOF
}

setup() {
  if [ -z "$HOST" ]; then
    echo "ERROR HOST is a required parameter."
    usage
    exit 0
  fi

  if [ -z "$TOKEN_FILE" ]; then
    echo "ERROR TOKEN_FILE is a required parameter."
    usage
    exit 0
  fi

  if [ -z "$EXPIRED_TOKEN_FILE" ]; then
    echo "ERROR EXPIRED_TOKEN_FILE is a required parameter."
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

do_introspect() {
  local token="$1"
  local hint="$2"
  local client_id="$3"
  local client_secret="$4"

  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "token_type_hint=$hint" \
    -d "token=$token" \
    -d "client_id=$client_id" \
    -d "client_secret=$client_secret" \
    "$HOST/introspect" > "$curl_status"
}

@test 'valid access token' {
  access_token=$(cat "$TOKEN_FILE" | jq ".access_token" | tr -d '"')
  do_introspect "$access_token" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq .active | tr -d '"')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("scope")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("username")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("exp")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("iat")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("sub")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("aud")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("iss")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("jti")')" == "true" ]
  [ "$(cat "$curl_body" | jq .token_type | tr -d '"')" == "Bearer" ]
  [ "$(cat "$curl_body" | jq .client_id | tr -d '"')" == "$CLIENT_ID" ]
  [ "$(cat "$curl_body" | jq 'has("uid")')" == "true" ]
}

@test 'valid id token' {
  id_token=$(cat "$TOKEN_FILE" | jq ".id_token" | tr -d '"')
  do_introspect "$id_token" "id_token" "$CLIENT_ID" "$CLIENT_SECRET"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq .active | tr -d '"')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("username")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("preferred_username")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("exp")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("iat")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("sub")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("aud")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("iss")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("jti")')" == "true" ]
  [ "$(cat "$curl_body" | jq .token_type | tr -d '"')" == "Bearer" ]
  [ "$(cat "$curl_body" | jq 'has("at_hash")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("idp")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("auth_time")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("amr")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("name")')" == "true" ]
}

@test 'expired access token' {
  do_introspect "$(cat $EXPIRED_TOKEN_FILE | jq .access_token | tr -d '"')" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq .active | tr -d '"')" == "false" ]
}

@test 'invalid id token' {
  do_introspect invalid "id_token" "$CLIENT_ID" "$CLIENT_SECRET"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq .active | tr -d '"')" == "false" ]
}