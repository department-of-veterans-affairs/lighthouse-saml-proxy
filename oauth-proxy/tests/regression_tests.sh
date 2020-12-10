#!/bin/bash
# Team Pivot!
# Simple script to test the Oauth Proxy.

# Dependency Check

if ! docker -v COMMAND &> /dev/null
then
    echo "please install docker."
    exit 1
fi

if ! jq --version COMMAND &> /dev/null
then
    echo "Please install jq."
    exit 1
fi

# Variables

TOKENS= 
CODE=
REDIRECT_URI="https://app/after-auth"
PASS=1
curl_status="$(mktemp)"
curl_body="$(mktemp)"

# Code and Token Utilities

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
    TOKENS="$(cat "$curl_body")"
  fi
}

assign_code() {
  local network=""
  if [[ $HOST == *"localhost"* ]];
  then
    network="-it --network container:oauth-proxy_oauth-proxy_1"
  else
    network=""
  fi
  if [[ $CODE_EXPIRED -gt 0 ]] || [[ -z $CODE ]];
  then
    code=$(docker run \
     $network \
     vasdvp/lighthouse-auth-utils:latest auth \
     --redirect-uri="$REDIRECT_URI" \
     --authorization-url="$HOST" \
     --user-email="$USER_EMAIL" \
     --user-password="$USER_PASSWORD" \
     --client-id="$CLIENT_ID" \
     --client-secret="$CLIENT_SECRET" \
     --code-only | jq)
    CODE=$(echo "$code" | jq ".code" | tr -d '"')
    if [[ -z $CODE ]];
    then
      echo -e "\nFailed to retrieve code."
      echo "This is likely a lighthouse-auth-utilities bot issue."
      echo "Check for valid configuration."
      echo "Exiting ... "
      exit 1
    fi
  fi
}

# ----

# Oauth Proxy functions

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

# Assertion functions 

#
# Compare the status ($1) with
# the status in file $curl_status
#
expect_status() {
  expected="$1"

  actual="$(cat "$curl_status")"

  if [ "$actual" != "$expected" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $actual"
    echo "  expected: $expected"
    echo "----"
    PASS=0
  fi
}

#
# Compare the JSON body ($1) with
# the JSON in file $curl_body
#
expect_json_body() {
  # write body to a file
  local expected_file
  expected_file="$(mktemp)"
  echo "$1" > "$expected_file"

  local actual_file
  actual_file=$curl_body

  if [ "$(cmp <(jq -cS . "$actual_file") <(jq -cS . "$expected_file"))" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $(jq -cS . "$actual_file
")"
    echo "  expected: $(jq -cS . "$expected_file
")"
    echo "----"
    PASS=0
  fi
}

#
# Compare the JSON property ($1)
# from the file $curl_body to the
# expected value ($2)
#
expect_json_property() {
  local expected_property="$1"
  local expected_value="$2"

  local actual_value
  actual_value="$(jq -r ".$expected_property" "$curl_body")"

  if [ "$actual_value" != "$expected_value" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $actual_value"
    echo "  expected: $expected_value"
    echo "----"
    PASS=0
  fi
}

#
# Will return true if JSON body has expected_property ($1)
#
has_json_property() {
  local expected_property="$1"
  local value=
  value="$(jq -r ".$expected_property" "$curl_body")"

  if [ "$value" = "null" ]; then
    echo "----"
    echo "FAIL:"
    echo "  could not find property:   $expected_property"
    echo "----"
    PASS=0
  fi
}

#
# Given only a property ($1), will check JSON for property.
# Given a property and value ($2), will check if JSON property  matches value.
#
has_or_expect_property() {
  local property=$1
  local value=$2

  if [[ -z $value ]];
  then
    has_json_property "$property"
  else
    expect_json_property "$property" "$value"
  fi
}
# -------

# Pulling latest lighthouse-auth-utils docker image if necessary
docker pull vasdvp/lighthouse-auth-utils:latest

#
# NOTE: State is important to these tests. 
# To increase speed and accuracy, authorization codes should be fetched minimally.
# They need to execute in a specific order or they could fail.
#

# Start Tests

echo "Running ... Token Handler code happy path"

assign_code
do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

has_json_property "access_token"
has_json_property "id_token"
has_json_property "refresh_token"
expect_json_property "token_type" "Bearer"
has_json_property "scope" 
has_json_property "expires_in" 
if [[ "$(cat "$curl_body" | jq .scope)" == *"launch/patient"* ]];
then
  has_json_property "patient"
fi
has_json_property "state" 

echo "Running ... Revoke active token happy path"

access_token=$(echo "$TOKENS" | jq ".access_token" | tr -d '"')
do_revoke_token "$access_token" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

expect_status 200

# The access token is now expired

echo "Running ... Introspect expired access token"

access_token=$(echo "$TOKENS" | jq ".access_token" | tr -d '"')
do_introspect "$access_token" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

expect_status 200
expect_json_body '{ "active": false }'

echo "Running ... Introspect valid id token"

do_introspect invalid "id_token" "$CLIENT_ID" "$CLIENT_SECRET"

expect_status 200
expect_json_body '{ "active": false }'

echo "Running ... Token Handler invalid code"

do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "Invalid" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"
expect_status 400
expect_json_body '{"error": "invalid_grant", "error_description": "The authorization code is invalid or has expired."}'

echo "Running ... Token Handler refresh happy path"

do_token "$(jq \
              -scn \
              --arg client_id "$CLIENT_ID" \
              --arg grant_type "refresh_token" \
              --arg refresh_token "$(echo "$TOKENS" | jq ".refresh_token" | tr -d '"')" \
              --arg secret "$CLIENT_SECRET" \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

expect_status 200

has_json_property "access_token"
has_json_property "id_token"
expect_json_property "refresh_token" "$(echo "$TOKENS" | jq ".refresh_token" | tr -d '"')"
expect_json_property "token_type" "Bearer"
has_json_property "scope" 
has_json_property "expires_in" 

if [[ "$(cat "$curl_body" | jq .scope)" == *"launch/patient"* ]];
then
  has_json_property "patient"
fi

has_json_property "state" 

echo "Running ... Token Handler expired code"

do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"
expect_status 400
expect_json_body '{"error": "invalid_grant", "error_description": "The authorization code is invalid or has expired."}'

echo "Running ... Introspect valid access token"

access_token=$(echo "$TOKENS" | jq ".access_token" | tr -d '"')
do_introspect "$access_token" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

expect_json_property "active" "true"
has_json_property "scope"
has_or_expect_property "username" "$USER_NAME"
has_json_property "exp"
has_json_property "iat"
has_json_property "sub"
has_or_expect_property "aud" "$AUDIENCE"
has_or_expect_property "iss" "$ISSUER"
has_json_property "jti"
expect_json_property "token_type" "Bearer"
expect_json_property "client_id" "$CLIENT_ID"
has_or_expect_property "uid" "$USERID"

echo "Running ... Introspect valid id token"

id_token=$(echo "$TOKENS" | jq ".id_token" | tr -d '"')
do_introspect "$id_token" "id_token" "$CLIENT_ID" "$CLIENT_SECRET"

expect_status 200
expect_json_property "active" "true"
has_or_expect_property "username" "$USER_NAME"
has_or_expect_property "preferred_username" "$USER_NAME"
has_json_property "exp" 
has_json_property "iat"
has_json_property "sub"
has_or_expect_property "aud" "$AUDIENCE"
has_or_expect_property "iss" "$ISSUER"
has_json_property "jti"
expect_json_property "token_type" "Bearer"
has_json_property "at_hash"
has_or_expect_property "idp" "$IDP"
has_json_property "auth_time"
has_json_property "amr"
has_or_expect_property "name" "$NAME"
has_or_expect_property "username" "$USER_NAME"

echo "Running ... Delete Okta grant happy path"

do_revoke_grant "$CLIENT_ID" "$USER_EMAIL"

expect_status 200 
expect_json_property "email" "$USER_EMAIL" 
expect_json_property "responses[0].status" "204" 
expect_json_property "responses[0].message" "Okta grants successfully revoked" 

echo "Running ... User Info happy path"
  
access_token=$(echo "$TOKENS" | jq ".access_token" | tr -d '"')

curl -s \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer ${access_token}" \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/userinfo" > "$curl_status"

expect_status 200

has_json_property "sub"
has_or_expect_property "name" "$NAME"
has_json_property "locale"
has_or_expect_property "preferred_username" "$USER_NAME"
has_or_expect_property "given_name" "$FIRST_NAME"
has_or_expect_property "middle_name" "$MIDDLE_NAME"
has_or_expect_property "family_name" "$LAST_NAME"
has_json_property "zoneinfo"
has_json_property "updated_at"

echo "Running ... Keys happy path"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/keys" > "$curl_status"

expect_status 200
has_json_property "keys[0].kty"
has_json_property "keys[0].alg"
has_json_property "keys[0].kid"
has_json_property "keys[0].use"
has_json_property "keys[0].e"
has_json_property "keys[0].n"

echo "Running ... Manage happy path"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/manage" > "$curl_status"

expect_status 302

echo "Running ... Authorize Handler with no state parameter"

if [[ -z $SCOPE ]];
then 
  SCOPE="openid%20profile%20disability_rating.read%20service_history.read%20veteran_status.read%20offline_access"
fi

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&redirect_uri=$REDIRECT_URI&aud=default" > "$curl_status"

expect_status 400
expect_json_body '{"error": "invalid_request", "error_description": "State parameter required"}'

echo "Running ... Token Handler refresh path invalid client id"
  
do_token "$(jq \
              -scn \
              --arg client_id "Invalid" \
              --arg grant_type "refresh_token" \
              --arg refresh_token "$(echo "$TOKENS" | jq ".refresh_token" | tr -d '"')" \
              --arg secret "$CLIENT_SECRET" \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

expect_status 401
expect_json_body '{"error":"expected 200 OK, got: 401 Unauthorized"}'

echo "Running ... Token Handler code path invalid client id"

do_token "$(jq \
                -scn \
                --arg client_id "Invalid" \
                --arg grant_type "authorization_code" \
                --arg code "$CODE" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

expect_status 401
expect_json_body '{"error":"expected 200 OK, got: 401 Unauthorized"}'

echo "Running ... Token Handler invalid strategy"

do_token "$(jq \
                -scn \
                --arg client_id "$CLIENT_ID" \
                --arg grant_type "invalid" \
                --arg secret "$CLIENT_SECRET" \
                '{"client_id": $client_id, "grant_type": $grant_type, "client_secret": $secret}')"

expect_status 400
expect_json_body '{"error":"unsupported_grant_type","error_description":"Only authorization and refresh_token grant types are supported"}'

echo "Running ... Token Handler invalid refresh token"

do_token "$(jq \
              -scn \
              --arg client_id "$CLIENT_ID" \
              --arg grant_type "refresh_token" \
              --arg refresh_token "Invalid" \
              --arg secret "$CLIENT_SECRET" \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"
expect_status 400
expect_json_body '{"error": "invalid_grant", "error_description": "The refresh token is invalid or expired."}'

echo "Running ... Revoke Okta grants invalid email"

do_revoke_grant "$CLIENT_ID" "invalid"

expect_status 400 
expect_json_body '{"error": "invalid_request", "error_description": "Invalid email address."}' 

echo "Running ... Revoke Okta grants invalid client"

do_revoke_grant "invalid" "$USER_EMAIL"

expect_status 400
expect_json_body '{"error": "invalid_request", "error_description": "Invalid client_id."}'

echo "Running ... Client Credentials happy path"

cc=$(do_client_credentials "launch/patient" "123V456")
echo "$cc" > "$curl_body"

has_json_property "access_token"
expect_json_property "token_type" "Bearer"
expect_json_property "scope" "launch/patient"
has_json_property "expires_in" 

# It is not feasible to test Client Credential edge cases yet.

# End of Tests ----

if [[ $PASS -gt 0 ]];
then
  echo "All tests passed!"
  exit 0
fi

echo "Some tests failed."
exit 1