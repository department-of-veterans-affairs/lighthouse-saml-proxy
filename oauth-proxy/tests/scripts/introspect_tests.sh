#!/bin/bash
# Team Pivot!

HOST=$1
TOKENS=$2
EXPIRED_ACCESS=$3

pass=1
curl_status="$(mktemp)"
curl_body="$(mktemp)"

if [[ -z $(echo "$TOKENS" | jq .access_token) ]];
then
  echo "ERROR - TOKENS is a required parameter."
  exit 1
fi

if [ -z "$HOST" ];
then
  echo "ERROR - HOST is a required parameter."
  exit 1
fi

if [ -z "$EXPIRED_ACCESS" ];
then
  echo "ERROR - EXPIRED_ACCESS is a required parameter."
  exit 1
fi

# Helper Functions

track_result() {
  if [[ "$?" -gt 0 ]]
  then
    pass=0
  fi
}

# --------

# Oauth Proxy Functions

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

# -------
echo -e "\nIntropsect Tests"

echo -e "\tRunning ... Introspect valid access token"

access_token=$(echo "$TOKENS" | jq ".access_token" | tr -d '"')
do_introspect "$access_token" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="active" --expected-value="true"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="scope" 
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="username" --expected-value="$USER_NAME"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="exp" 
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="iat" 
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="sub" 
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="aud" --expected-value="$AUDIENCE"
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="iss" --expected-value="$ISSUER"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="jti" 
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="token_type" --expected-value="Bearer"
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="client_id" --expected-value="$CLIENT_ID"
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="uid" --expected-value="$USERID"
track_result

echo -e "\tRunning ... Introspect valid id token"

id_token=$(echo "$TOKENS" | jq ".id_token" | tr -d '"')
do_introspect "$id_token" "id_token" "$CLIENT_ID" "$CLIENT_SECRET"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="active" --expected-value="true"
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="username" --expected-value="$USER_NAME"
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="preferred_username" --expected-value="$USER_NAME"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="exp" 
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="iat" 
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="sub" 
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="aud" --expected-value="$AUDIENCE"
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="iss" --expected-value="$ISSUER"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="jti" 
track_result
./assertions.sh --expect-property --json="$(cat "$curl_body")" --property="token_type" --expected-value="Bearer"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="at_hash" 
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="idp" --expected-value="$IDP"
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="auth_time" 
track_result
./assertions.sh --has-property --json="$(cat "$curl_body")" --property="amr" 
track_result
./assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="name" --expected-value="$NAME"
track_result

echo -e "\tRunning ... Introspect expired access token"

do_introspect "$EXPIRED_ACCESS" "access_token" "$CLIENT_ID" "$CLIENT_SECRET"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
./assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{ "active": false }'
track_result

echo -e "\tRunning ... Introspect invalid id token"

do_introspect invalid "id_token" "$CLIENT_ID" "$CLIENT_SECRET"

./assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
./assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{ "active": false }'
track_result

if [[ $pass -lt 1 ]];
then
  echo -e "\tFAIL - Some introspect tests did not pass."
  exit 1
fi

exit 0