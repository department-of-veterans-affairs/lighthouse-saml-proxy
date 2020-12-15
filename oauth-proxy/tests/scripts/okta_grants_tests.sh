#!/usr/bin/env bash
# Team Pivot!

HOST=
DIR="$(readlink -f "$(dirname "$0")")"

pass=1
curl_status="$(mktemp)"
curl_body="$(mktemp)"

usage() {
cat <<EOF
Tests the Oauth Proxy's DELETE grants endpoint.

Example
  ./okta_grants_tests.sh --host=https://sandbox-api.va.gov/oauth2
EOF
exit 1
}

for i in "$@"
do
case $i in
    
    --host=*)
      HOST="${i#*=}"; shift ;;
    --help|-h)
      usage ;  exit 1 ;;
    --) shift ; break ;;
    *) usage ; exit 1 ;;
esac
done

if [ -z "$HOST" ];
then
  echo "ERROR - HOST is a required parameter."
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

# -------

echo -e "\nDelete Grants Tests"

echo -e "\tRunning ... Delete Okta grant happy path"

do_revoke_grant "$CLIENT_ID" "$USER_EMAIL"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
"$DIR"/assertions.sh --expect-property --json="$(cat "$curl_body")" --property="email" --expected-value="$USER_EMAIL"
track_result
"$DIR"/assertions.sh --expect-property --json="$(cat "$curl_body")" --property="responses[0].status" --expected-value="204"
track_result
"$DIR"/assertions.sh --expect-property --json="$(cat "$curl_body")" --property="responses[0].message" --expected-value="Okta grants successfully revoked"
track_result

echo -e "\tRunning ... Revoke Okta grants invalid email"

do_revoke_grant "$CLIENT_ID" "invalid"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result 
"$DIR"/assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error": "invalid_request", "error_description": "Invalid email address."}'
track_result

echo -e "\tRunning ... Revoke Okta grants invalid client"

do_revoke_grant "invalid" "$USER_EMAIL"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result
"$DIR"/assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error": "invalid_request", "error_description": "Invalid client_id."}'
track_result

if [[ $pass -lt 1 ]];
then
  echo -e "\tFAIL - Some grants tests did not pass."
  exit 1
fi

exit 0