#!/usr/bin/env bash
# Team Pivot!

HOST=
TOKENS=

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
pass=1
curl_status="$(mktemp)"
curl_body="$(mktemp)"

usage() {
cat <<EOF
Tests the variety of minor Oauth Proxy endpoints.

Example
  ./other_tests.sh --host=https://sandbox-api.va.gov/oauth2 --tokens={ Tokens }
EOF
exit 1
}

for i in "$@"
do
case $i in

    --host=*)
      HOST="${i#*=}"; shift ;;
    --tokens=*)
      TOKENS="${i#*=}"; shift ;;
    --help|-h)
      usage ;  exit 1 ;;
    --) shift ; break ;;
    *) usage ; exit 1 ;;
esac
done

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

# Helper Functions

track_result() {
  if [[ "$?" -gt 0 ]]
  then
    pass=0
  fi
}

# --------
echo -e "\nMisc. Tests"

echo -e "\tRunning ... User Info happy path"

access_token=$(echo "$TOKENS" | jq ".access_token" | tr -d '"')

curl -s \
  -H 'Accept: application/json' \
  -H "Authorization: Bearer ${access_token}" \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/userinfo" > "$curl_status"


"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="sub"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="name" --expected-value="$NAME"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="locale"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="preferred_username" --expected-value="$USER_NAME"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="given_name" --expected-value="$FIRST_NAME"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="middle_name" --expected-value="$MIDDLE_NAME"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="family_name" --expected-value="$LAST_NAME"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="zoneinfo"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="updated_at"
track_result

echo -e "\tRunning ... Keys happy path"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/keys" > "$curl_status"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="keys[0].kty"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="keys[0].alg"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="keys[0].kid"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="keys[0].use"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="keys[0].e"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="keys[0].n"
track_result


echo -e "\tRunning ... Manage happy path"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/manage" > "$curl_status"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=302
track_result

echo -e "\tRunning ... Manage no path"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/noManage/manage" > "$curl_status"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=404
track_result

echo -e "\tRunning ... Authorize Handler with no state parameter"

if [[ -z $SCOPE ]];
then
  SCOPE="openid%20profile%20disability_rating.read%20service_history.read%20veteran_status.read%20offline_access"
fi

curl -s \
  -Ls -w "%{url_effective}" -o /dev/null \
  "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&redirect_uri=$REDIRECT_URI&aud=default" > "$curl_status"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status="$REDIRECT_URI?error=invalid_request&error_description=State+parameter+required"
track_result

echo -e "\tRunning ... Authorize Handler with no redirect_uri"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&redirect_uri=&aud=default" > "$curl_status"

  "$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result

"$DIR"/assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error": "invalid_request", "error_description": "There was no redirect URI specified by the application."}'
track_result

echo -e "\tRunning ... Authorize Handler with undefined redirect_uri"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&aud=default" > "$curl_status"

  "$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result

"$DIR"/assertions.sh --expect-json --json="$(cat "$curl_body")" --expected-json='{"error": "invalid_request", "error_description": "There was no redirect URI specified by the application."}'
track_result

echo -e "\tRunning ... Redirect Handler without a redirect_url that can be looked up"
curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/redirect?code=xxxsomecode&state=xxxxxxstatewithnoredirect" > "$curl_status"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=400
track_result

echo -e "\tRunning ... Metadata endpoint test"

curl -s \
  -w "%{http_code}" \
  -o "$curl_body" \
  "$HOST/.well-known/openid-configuration" > "$curl_status"

"$DIR"/assertions.sh --expect-status --status="$(cat "$curl_status")" --expected-status=200
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="issuer" --expected-value="$ISSUER"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="authorization_endpoint" --expected-value="$AUTHORIZATION_ENDPOINT"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="token_endpoint" --expected-value="$TOKEN_ENDPOINT"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="userinfo_endpoint" --expected-value="$USERINFO_ENDPOINT"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="introspection_endpoint" --expected-value="$INTROSPECTION_ENDPOINT"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="revocation_endpoint" --expected-value="$REVOCATION_ENDPOINT"
track_result
"$DIR"/assertions.sh --has-or-expect-property --json="$(cat "$curl_body")" --property="jwks_uri" --expected-value="$JWKS_URI"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="scopes_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="response_types_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="response_modes_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="grant_types_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="subject_types_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="id_token_signing_alg_values_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="token_endpoint_auth_methods_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="revocation_endpoint_auth_methods_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="claims_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="code_challenge_methods_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="introspection_endpoint_auth_methods_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="request_parameter_supported"
track_result
"$DIR"/assertions.sh --has-property --json="$(cat "$curl_body")" --property="request_object_signing_alg_values_supported"
track_result

if [[ $pass -lt 1 ]];
then
  echo -e "\tFAIL - Some misc. tests did not pass."
  exit 1
fi

exit 0
