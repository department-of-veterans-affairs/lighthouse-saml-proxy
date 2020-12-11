#!/usr/bin/env bash
# Team Pivot!

HOST=$1
CODE=$2
TOKEN_FILE=$3
EXPIRED_TOKEN_FILE=$4

pass=1
curl_status="$(mktemp)"
curl_body="$(mktemp)"

if [[ -z "$TOKEN_FILE" ]];
then
  echo "ERROR - TOKEN_FILE is a required parameter."
  exit 1
fi

if [[ -z "$EXPIRED_TOKEN_FILE" ]];
then
  echo "ERROR - EXPIRED_TOKEN_FILE is a required parameter."
  exit 1
fi

if [ -z "$HOST" ];
then
  echo "ERROR - HOST is a required parameter."
  exit 1
fi

if [ -z "$CODE" ];
then
  echo "ERROR - CODE is a required parameter."
  exit 1
fi

# Oauth Proxy functions

do_token() {
  payload="$1"
  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "$payload" \
    "$HOST/token?redirect_uri=$REDIRECT_URI" > "$curl_status"
  if [[ "$(cat "$curl_status")" == "200" ]] && [ "$(cat "$curl_body" | jq ".error")" = "null" ];
  then
    cat "$curl_body" > "$TOKEN_FILE"
  fi
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
    url="https://dev-api.va.gov/oauth2/health-insurance/v1"
  fi

  if [[ $HOST == *"sandbox"* ]];
  then
    url="https://sandbox-api.va.gov/oauth2/health-insurance/v1"
  fi

  if [[ $HOST == *"localhost"* ]];
  then
    url="http://localhost:7100/oauth2/health-insurance/v1"
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

# ----

# Helper Functions

track_result() {
  if [[ "$?" -gt 0 ]]
  then
    pass=0
  fi
}

# --------
echo -e "\nToken Tests"

echo -e "\tRunning ... Token Handler code happy path"

do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="access_token"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="id_token"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="refresh_token"
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="token_type" --expected-value="Bearer"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="scope"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="expires_in"
track_result

if [[ "$(cat "$curl_body" | jq .scope)" == *"launch/patient"* ]];
then
  ./assertions.sh --has-property --json="$(cat "$curl_body")" --property="patient"
  track_result
fi

./assertions.sh --has-property --json="$(cat "$curl_body")" --property="state"
track_result

echo -e "\tRunning ... Token Handler expired code"

do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result
./assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error": "invalid_grant", "error_description": "The authorization code is invalid or has expired."}'
track_result

echo -e "\tRunning ... Token Handler invalid code"

do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "Invalid" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result
./assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error": "invalid_grant", "error_description": "The authorization code is invalid or has expired."}'
track_result

echo -e "\tRunning ... Token Handler code path invalid client id"

do_token "$(jq \
                -scn \
                --arg client_id "Invalid" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=401
track_result

# expect_json_body '{"error":"invalid_client", "error_description": "Invalid value for client_id parameter."}'

echo -e "\tRunning ... Revoke active token happy path"

cat "$TOKEN_FILE" > "$EXPIRED_TOKEN_FILE"
access_token=$(cat "$TOKEN_FILE" | jq ".access_token" | tr -d '"')
do_revoke_token "$access_token" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result

# The access token is now expired

echo -e "\tRunning ... Token Handler refresh happy path"
refresh=$(cat "$TOKEN_FILE" | jq ".refresh_token" | tr -d '"')

do_token "$(jq \
              -scn \
              --arg client_id "$CLIENT_ID" \
              --arg grant_type "refresh_token" \
              --arg refresh_token "$refresh" \
              --arg secret "$CLIENT_SECRET" \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="access_token"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="id_token"
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="refresh_token" --expected-value="$refresh"
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="token_type" --expected-value="Bearer"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="scope"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="expires_in"
track_result

if [[ "$(cat "$curl_body" | jq .scope)" == *"launch/patient"* ]];
then
  ./assertions.sh --has-property --json="$(cat "$curl_body")" --property="patient"
  track_result
fi

./assertions.sh --has-property --json="$(cat "$curl_body")" --property="state"
track_result

echo -e "\tRunning ... Token Handler invalid refresh token"

do_token "$(jq \
              -scn \
              --arg client_id "$CLIENT_ID" \
              --arg grant_type "refresh_token" \
              --arg refresh_token "Invalid" \
              --arg secret "$CLIENT_SECRET" \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result
./assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error": "invalid_grant", "error_description": "The refresh token is invalid or expired."}'
track_result

echo -e "\tRunning ... Token Handler refresh path invalid client id"
  
do_token "$(jq \
              -scn \
              --arg client_id "Invalid" \
              --arg grant_type "refresh_token" \
              --arg refresh_token "$(cat "$TOKEN_FILE" | jq ".refresh_token" | tr -d '"')" \
              --arg secret "$CLIENT_SECRET" \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"


./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=401
track_result
# expect_json_body '{"error":"invalid_client", "error_description": "Invalid value for client_id parameter."}'

echo -e "\tRunning ... Client Credentials happy path"

cc=$(do_client_credentials "launch/patient" "123V456")

./assertions.sh --has-property --json=$cc --property="access_token"
track_result
./assertions.sh --expect-property --json="$cc" --property="token_type" --expected-value="Bearer"
track_result
./assertions.sh --expect-property --json="$cc" --property="scope" --expected-value="launch/patient"
track_result
./assertions.sh --has-property --json="$cc" --property="expires_in"
track_result

echo -e "\tRunning ... Token Handler invalid strategy"

do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "invalid" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "client_secret": $secret}')"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result
./assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error":"unsupported_grant_type","error_description":"Only authorization and refresh_token grant types are supported"}'
track_result

# It is not feasible to test Client Credential edge cases yet.

if [[ $pass -lt 1 ]];
then
  echo -e "\tFAIL - Some token tests did not pass."
  exit 1
fi

exit 0