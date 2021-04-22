#!/usr/bin/env bats

usage() {
cat <<EOF
Tests the Oauth Proxy's token endpoint.

Example
  HOST="https://sandbox-api.va.gov/oauth2" CODE={code} TOKEN_FILE={ Token File } EXPIRED_TOKEN_FILE={ Expired Token File } CLIENT_ID={Client ID} CLIENT_SECRET={Client Secret} CC_CLIENT_ID={CC Client ID} CC_CLIENT_SECRET={CC Client Secret} bats ./token_tests.bats
EOF
}

setup() {
  if [ -z "$HOST" ]; then
    echo "ERROR HOST is a required parameter."
    usage
    exit 0
  fi

  if [ -z "$CODE" ];
  then
    echo "ERROR - CODE is a required parameter."
    usage
    exit 1
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

  if [ -z "$CLIENT_ID" ]; then
    echo "ERROR CLIENT_ID is a required parameter."
    usage
    exit 0
  fi

  if [ -z "$CLIENT_SECRET" ]; then
    echo "ERROR CLIENT_SECRET is a required parameter."
    usage
    exit 0
  fi

  if [ -z "$CC_CLIENT_ID" ]; then
    echo "ERROR CC_CLIENT_ID is a required parameter."
    usage
    exit 0
  fi

  if [ -z "$CC_CLIENT_SECRET" ]; then
    echo "ERROR CC_CLIENT_SECRET is a required parameter."
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

do_revoke_token() { 
  local token=$1
  local grant_type=$2
  local client_id=$3
  local client_secret=$4
  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "grant_type=$grant_type" \
    -d "token=$token" \
    -d "client_id=$client_id" \
    -d "client_secret=$client_secret" \
    "$HOST/revoke" > "$curl_status"
}

do_client_credentials() { 
  local scope=$1
  local launch=$2

  local url=
  local network=""
  if [[ $HOST == *"dev"* ]];
  then
    url="https://dev-api.va.gov/oauth2/health/system/v1"
  fi

  if [[ $HOST == *"sandbox"* ]];
  then
    url="https://sandbox-api.va.gov/oauth2/health/system/v1"
  fi

  if [[ $HOST == *"staging"* ]];
  then
    url="https://staging-api.va.gov/oauth2/health/system/v1"
  fi

  if [[ $HOST == *"localhost"* ]];
  then
    url="http://localhost:7100/oauth2/health/system/v1"
    network="-it --network container:oauth-proxy_oauth-proxy_1"
  fi

  local cc
  cc="$(docker run $network \
          vasdvp/lighthouse-auth-utils:latest auth-cc \
          --client-id="$CC_CLIENT_ID" \
          --client-secret="$CC_CLIENT_SECRET" \
          --authorization-url=$url \
          --scope="$scope" \
          --launch="$launch")"
  echo "$cc"
}

do_token() {
  payload="$1"
  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "$payload" \
    "$HOST/TOKEN?redirect_uri=$REDIRECT_URI" > "$curl_status"
  if [[ "$(cat "$curl_status")" == "200" ]] && [ "$(cat "$curl_body" | jq ".error")" = "null" ];
  then
    echo "$(cat "$curl_body")" > "$TOKEN_FILE"
  fi
}
@test 'Token Handler code happy path' {
  do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq 'has("access_token")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("id_token")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("refresh_token")')" == "true" ]
  [ "$(cat "$curl_body" | jq .token_type | tr -d '"')" == "Bearer" ]
  [ "$(cat "$curl_body" | jq 'has("scope")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("expires_in")')" == "true" ]
  if [[ "$(cat "$curl_body" | jq .scope  | tr -d '"')" == *"launch/patient"* ]];
  then
    [ "$(cat "$curl_body" | jq 'has("patient")')" == "true" ]
  fi

  [ "$(cat "$curl_body" | jq 'has("state")')" == "true" ]
}

@test 'Token Handler expired code' {
  do_token "$(jq \
                  -scn \
                  --arg client_id "$CLIENT_ID" \
                  --arg grant_type "authorization_code" \
                  --arg code "$CODE" \
                  --arg secret "$CLIENT_SECRET" \
                  '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_grant" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "The authorization code is invalid or has expired." ]
}

@test 'Token Handler invalid code' {
do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "Invalid" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_grant" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "The authorization code is invalid or has expired." ]
}

@test 'Token Handler code path invalid client id' {
do_token "$(jq \
                -scn \
                --arg client_id "Invalid" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 401 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_client" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "Invalid value for client_id parameter." ]
}

@test 'Revoke active token happy path' {
  access_token=$(cat "$TOKEN_FILE" | jq ".access_token" | tr -d '"')
  do_revoke_token "$access_token" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

  [ "$(cat "$curl_status")" -eq 200 ]
  cat "$TOKEN_FILE" > "$EXPIRED_TOKEN_FILE"
}

@test 'Token Handler refresh happy path' {
  refresh=$(cat "$TOKEN_FILE" | jq ".refresh_token" | tr -d '"')

  do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "refresh_token" \
                --arg refresh_token "$refresh" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq 'has("access_token")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("id_token")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("refresh_token")')" == "true" ]
  [ "$(cat "$curl_body" | jq .token_type | tr -d '"')" == "Bearer" ]
  [ "$(cat "$curl_body" | jq 'has("scope")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("expires_in")')" == "true" ]
  if [[ "$(cat "$curl_body" | jq .scope | tr -d '"')" == *"launch/patient"* ]];
  then
    [ "$(cat "$curl_body" | jq 'has("patient")')" == "true" ]
  fi
  [ "$(cat "$curl_body" | jq 'has("state")')" == "true" ]
}

@test 'Token Handler invalid refresh Token' {
do_token "$(jq \
              -scn \
              --arg client_id "$CLIENT_ID" \
              --arg grant_type "refresh_token" \
              --arg refresh_token "Invalid" \
              --arg secret "$CLIENT_SECRET" \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_grant" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "The refresh token is invalid or expired." ]
}

@test 'Token Handler refresh path invalid client id' {
  do_token "$(jq \
                -scn \
                --arg client_id "Invalid" \
                --arg grant_type "refresh_token" \
                --arg refresh_token "$(cat "$TOKEN_FILE" | jq ".refresh_token" | tr -d '"')" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 401 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_client" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "Invalid value for client_id parameter." ]
}

@test 'Client Credentials happy path' {
  cc=$(do_client_credentials "launch/patient" "123V456")

  [ "$(echo "$cc" | jq 'has("access_token")')" == "true" ]
  [ "$(echo "$cc" | jq .token_type | tr -d '"')" == "Bearer" ]
  [ "$(echo "$cc" | jq .scope | tr -d '"')" == "launch/patient" ]
  [ "$(echo "$cc" | jq 'has("expires_in")')" == "true" ]
}

@test 'Token Handler invalid strategy' {
  do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "invalid" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "unsupported_grant_type" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "Only authorization_code, refresh_token, and client_credentials grant types are supported" ]
}

@test 'Token Handler missing grant_type' {
  do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "client_secret": $secret}')"

  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_request" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "A grant type is required. Supported grant types are authorization_code, refresh_token, and client_credentials." ]
}