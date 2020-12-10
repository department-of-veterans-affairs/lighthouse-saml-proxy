#!/bin/bash
# Team Pivot!
# Simple scipt to test the Oauth Proxy.

# Variables

TOKENS= 
CODE=
REDIRECT_URI="https://app/after-auth"
PASS=1
curl_status="$(mktemp)"
curl_body="$(mktemp)"

# Code and Token Utilities

doToken() {
  payload="$1"
  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "$payload" \
    "$HOST/token?redirect_uri=$REDIRECT_URI" > $curl_status
  if [[ "$(cat $curl_status)" == "200" ]] && [ $(cat $curl_body | jq ".error") = "null" ];
  then
    TOKENS="$(cat $curl_body)"
  fi
}

assign_code() {
  network=
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
     --redirect-uri=$REDIRECT_URI \
     --authorization-url=$HOST \
     --user-email=$USER_EMAIL \
     --user-password=$USER_PASSWORD \
     --client-id=$CLIENT_ID \
     --client-secret=$CLIENT_SECRET \
     --code-only | jq)
    CODE=$(echo $code | jq ".code" | tr -d '"')
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

doRevoke_grant() {
  client="$1"
  email="$2"

  curl -X DELETE \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "$(jq \
            -scn \
            --arg client $client \
            --arg email $email \
            '{"client_id": $client, "email": $email}')" \
    "$HOST/grants" > $curl_status
}

doIntrospect() {
  token="$1"
  hint="$2"
  client_id="$3"
  client_secret="$4"
  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "token_type_hint=$hint" \
    -d "token=$token" \
    -d "client_id"=$client_id \
    -d "client_secret"=$client_secret \
    "$HOST/introspect" > $curl_status
}

doRevoke_Token() { 
  token=$1
  grant_type=$2
  client_id=$3
  client_secret=$4
  curl -X POST \
    -s \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -w "%{http_code}" \
    -o "$curl_body" \
    -d "grant_type=$grant_type" \
    -d "token=$token" \
    -d "client_id"=$client_id \
    -d "client_secret"=$client_secret \
    "$HOST/revoke" > $curl_status
}

doToken_ClientCredentials() { 
  local scope=$1
  local launch=$2

  local url=
  local network=
  if [[ $HOST == *"dev"* ]];
  then
    url="https://dev-api.va.gov/oauth2/health-insurance/v1"
    network=""
  fi

  if [[ $HOST == *"sandbox"* ]];
  then
    url="https://sandbox-api.va.gov/oauth2/health-insurance/v1"
    network="" 
  fi

  if [[ $HOST == *"localhost"* ]];
  then
    url="http://localhost:7100/oauth2/health-insurance/v1"
    network="-it --network container:oauth-proxy_oauth-proxy_1"
  fi

  echo $(docker run \
          $network \
          vasdvp/lighthouse-auth-utils:latest auth-cc \
          --client-id=$CC_CLIENT_ID \
          --client-secret=$CC_CLIENT_SECRET \
          --authorization-url=$url \
          --scope=$scope \
          --launch=$launch)
}

# ----

# Assertion functions 

#
# Compare the status ($1) with
# the status in file $curl_status
#
expectStatus() {
  expected="$1"

  actual="$(cat $curl_status)"

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
expectJsonBody() {
  expectedBody="$1"

  # write body to a file
  expectedFile="$(mktemp)"
  echo "$1" > $expectedFile

  actualFile=$curl_body

  if [ "$(cmp <(jq -cS . $actualFile) <(jq -cS . $expectedFile))" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $(jq -cS . $actualFile)"
    echo "  expected: $(jq -cS . $expectedFile)"
    echo "----"
    PASS=0
  fi
}

#
# Compare the JSON property ($1)
# from the file $curl_body to the
# expected value ($2)
#
expectJsonProperty() {
  expectedProperty="$1"
  expectedValue="$2"

  actualValue="$(jq -r ".$expectedProperty" $curl_body)"

  if [ "$actualValue" != "$expectedValue" ]; then
    echo "----"
    echo "FAIL:"
    echo "  actual:   $actualValue"
    echo "  expected: $expectedValue"
    echo "----"
    PASS=0
  fi
}

#
# Will return true if JSON body has expectedProperty ($1)
#
hasJsonProperty() {
  expectedProperty="$1"
  value="$(jq -r ".$expectedProperty" $curl_body)"

  if [ "$value" = "null" ]; then
    echo "----"
    echo "FAIL:"
    echo "  could not find property:   $expectedProperty"
    echo "----"
    PASS=0
  fi
}

#
# Given only a property ($1), will check JSON for property.
# Given a property and value ($2), will check if JSON property  matches value.
#
hasOrExpectProperty() {
  local property=$1
  local value=$2

  if [[ -z $value ]];
  then
    hasJsonProperty $property
  else
    expectJsonProperty $property $value
  fi
}
# -------

# Pulling lighthouse-auth-utils docker image if not on server

DOCKER_IMAGE=$(docker image inspect vasdvp/lighthouse-auth-utils:latest | jq .[0].RepoTags[0])
if [ $DOCKER_IMAGE != '"vasdvp/lighthouse-auth-utils:latest"' ]
then
  docker pull vasdvp/lighthouse-auth-utils:latest
fi

#
# NOTE: State is important to these tests. 
# To increase speed and accuracy, authorization codes should be fetched minimally.
# They need to execute in a specific order or they could fail.
#

# Start Tests

echo "Running ... Token Handler code happy path"

assign_code
doToken "$(jq \
                -scn \
                --arg client_id $CLIENT_ID \
                --arg grant_type "authorization_code" \
                --arg code $CODE \
                --arg secret $CLIENT_SECRET \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

hasJsonProperty "access_token"
hasJsonProperty "id_token"
hasJsonProperty "refresh_token"
expectJsonProperty "token_type" "Bearer"
hasJsonProperty "scope" 
hasJsonProperty "expires_in" 
if [[ "$(cat $curl_body | jq .scope)" == *"launch/patient"* ]];
then
  hasJsonProperty "patient"
fi
hasJsonProperty "state" 

echo "Running ... Revoke active token happy path"

access_token=$(echo $TOKENS | jq ".access_token" | tr -d '"')
doRevoke_Token $access_token "access_token" $CLIENT_ID $CLIENT_SECRET

expectStatus 200

# The access token is now expired

echo "Running ... Introspect expired access token"

access_token=$(echo $TOKENS | jq ".access_token" | tr -d '"')
doIntrospect $access_token "access_token" $CLIENT_ID $CLIENT_SECRET

expectStatus 200
expectJsonBody '{ "active": false }'

echo "Running ... Introspect valid id token"

doIntrospect invalid "id_token" $CLIENT_ID $CLIENT_SECRET

expectStatus 200
expectJsonBody '{ "active": false }'

echo "Running ... Token Handler invalid code"

doToken "$(jq \
                -scn \
                --arg client_id $CLIENT_ID \
                --arg grant_type "authorization_code" \
                --arg code "Invalid" \
                --arg secret $CLIENT_SECRET \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"
expectStatus 400
expectJsonBody '{"error": "invalid_grant", "error_description": "The authorization code is invalid or has expired."}'

echo "Running ... Token Handler refresh happy path"

doToken "$(jq \
              -scn \
              --arg client_id $CLIENT_ID \
              --arg grant_type "refresh_token" \
              --arg refresh_token $(echo $TOKENS | jq ".refresh_token" | tr -d '"') \
              --arg secret $CLIENT_SECRET \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

expectStatus 200

hasJsonProperty "access_token"
hasJsonProperty "id_token"
expectJsonProperty "refresh_token" $(echo $TOKENS | jq ".refresh_token" | tr -d '"')
expectJsonProperty "token_type" "Bearer"
hasJsonProperty "scope" 
hasJsonProperty "expires_in" 
if [[ "$(cat $curl_body | jq .scope)" == *"launch/patient"* ]];
then
  hasJsonProperty "patient"
fi
hasJsonProperty "state" 

echo "Running ... Token Handler expired code"

doToken "$(jq \
                -scn \
                --arg client_id $CLIENT_ID \
                --arg grant_type "authorization_code" \
                --arg code $CODE \
                --arg secret $CLIENT_SECRET \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"
expectStatus 400
expectJsonBody '{"error": "invalid_grant", "error_description": "The authorization code is invalid or has expired."}'

echo "Running ... Introspect valid access token"

access_token=$(echo $TOKENS | jq ".access_token" | tr -d '"')
doIntrospect $access_token "access_token" $CLIENT_ID $CLIENT_SECRET

expectJsonProperty "active" "true"
hasJsonProperty "scope"
hasOrExpectProperty "username" $USER_NAME
hasJsonProperty "exp"
hasJsonProperty "iat"
hasJsonProperty "sub"
hasOrExpectProperty "aud" $AUDIENCE
hasOrExpectProperty "iss" $ISSUER
hasJsonProperty "jti"
expectJsonProperty "token_type" "Bearer"
expectJsonProperty "client_id" $CLIENT_ID
hasOrExpectProperty "uid" $USERID

echo "Running ... Introspect valid id token"

id_token=$(echo $TOKENS | jq ".id_token" | tr -d '"')
doIntrospect $id_token "id_token" $CLIENT_ID $CLIENT_SECRET

expectStatus 200
expectJsonProperty "active" "true"
hasOrExpectProperty "username" $USER_NAME
hasOrExpectProperty "preferred_username" $USER_NAME
hasJsonProperty "exp" 
hasJsonProperty "iat"
hasJsonProperty "sub"
hasOrExpectProperty "aud" $AUDIENCE
hasOrExpectProperty "iss" $ISSUER
hasJsonProperty "jti"
expectJsonProperty "token_type" "Bearer"
hasJsonProperty "at_hash"
hasOrExpectProperty "idp" $IDP
hasJsonProperty "auth_time"
hasJsonProperty "amr"
hasOrExpectProperty "name" $NAME
hasOrExpectProperty "username" $USER_NAME

echo "Running ... Delete Okta grant happy path"

doRevoke_grant $CLIENT_ID $USER_EMAIL

expectStatus 200 
expectJsonProperty "email" "$USER_EMAIL" 
expectJsonProperty "responses[0].status" "204" 
expectJsonProperty "responses[0].message" "Okta grants successfully revoked" 

echo "Running ... User Info happy path"
  
access_token=$(echo $TOKENS | jq ".access_token" | tr -d '"')

curl -s \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer ${access_token}" \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/userinfo" > $curl_status

expectStatus 200

hasJsonProperty "sub"
hasOrExpectProperty "name" $NAME
hasJsonProperty "locale"
hasOrExpectProperty "preferred_username" $USER_NAME
hasOrExpectProperty "given_name" $FIRST_NAME
hasOrExpectProperty "middle_name" $MIDDLE_NAME
hasOrExpectProperty "family_name" $LAST_NAME
hasJsonProperty "zoneinfo"
hasJsonProperty "updated_at"

echo "Running ... Keys happy path"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/keys" > $curl_status

expectStatus 200
hasJsonProperty "keys[0].kty"
hasJsonProperty "keys[0].alg"
hasJsonProperty "keys[0].kid"
hasJsonProperty "keys[0].use"
hasJsonProperty "keys[0].e"
hasJsonProperty "keys[0].n"

echo "Running ... Manage happy path"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/manage" > $curl_status

expectStatus 302

echo "Running ... Authorize Handler with no state parameter"

if [[ -z $SCOPE ]];
then 
  SCOPE="openid%20profile%20disability_rating.read%20service_history.read%20veteran_status.read%20offline_access"
fi

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&redirect_uri=$REDIRECT_URI&aud=default" > $curl_status

expectStatus 400
expectJsonBody '{"error": "invalid_request", "error_description": "State parameter required"}'

echo "Running ... Token Handler refresh path invalid client id"
  
doToken "$(jq \
              -scn \
              --arg client_id "Invalid" \
              --arg grant_type "refresh_token" \
              --arg refresh_token $(echo $TOKENS | jq ".refresh_token" | tr -d '"') \
              --arg secret $CLIENT_SECRET \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"

expectStatus 401
expectJsonBody '{"error":"expected 200 OK, got: 401 Unauthorized"}'

echo "Running ... Token Handler code path invalid client id"

doToken "$(jq \
                -scn \
                --arg client_id "Invalid" \
                --arg grant_type "authorization_code" \
                --arg code $CODE \
                --arg secret $CLIENT_SECRET \
                '{"client_id": $client_id, "grant_type": $grant_type, "code": $code, "client_secret": $secret}')"

expectStatus 401
expectJsonBody '{"error":"expected 200 OK, got: 401 Unauthorized"}'

echo "Running ... Token Handler invalid strategy"

doToken "$(jq \
                -scn \
                --arg client_id $CLIENT_ID \
                --arg grant_type "invalid" \
                --arg secret $CLIENT_SECRET \
                '{"client_id": $client_id, "grant_type": $grant_type, "client_secret": $secret}')"

expectStatus 400
expectJsonBody '{"error":"unsupported_grant_type","error_description":"Only authorization and refresh_token grant types are supported"}'

echo "Running ... Token Handler invalid refresh token"

doToken "$(jq \
              -scn \
              --arg client_id $CLIENT_ID \
              --arg grant_type "refresh_token" \
              --arg refresh_token "Invalid" \
              --arg secret $CLIENT_SECRET \
              '{"client_id": $client_id, "grant_type": $grant_type, "refresh_token": $refresh_token, "client_secret": $secret}')"
expectStatus 400
expectJsonBody '{"error": "invalid_grant", "error_description": "The refresh token is invalid or expired."}'

echo "Running ... Revoke Okta grants invalid email"

status="$(doRevoke_grant "$CLIENT_ID" "invalid")"

expectStatus 400 
expectJsonBody '{"error": "invalid_request", "error_description": "Invalid email address."}' 

echo "Running ... Revoke Okta grants invalid client"

status="$(doRevoke_grant "invalid" "$USER_EMAIL")"

expectStatus 400
expectJsonBody '{"error": "invalid_request", "error_description": "Invalid client_id."}'

echo "Running ... Client Credentials happy path"

cc=$(doToken_ClientCredentials "launch/patient" "123V456")
echo $cc > $curl_body

hasJsonProperty "access_token"
expectJsonProperty "token_type" "Bearer"
expectJsonProperty "scope" "launch/patient"
hasJsonProperty "expires_in" 

# It is not feasible to test Client Credential edge cases yet.

# End of Tests ----

if [[ $PASS -gt 0 ]];
then
  echo "All tests passed!"
  exit 0
fi

echo "Some tests failed."
exit 1