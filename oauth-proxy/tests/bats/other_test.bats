#!/usr/bin/env bats

usage() {
cat <<EOF
Tests the Oauth Proxy's Introspect endpoint.

Example
  HOST="https://sandbox-api.va.gov/oauth2" TOKEN_FILE={token file} CLIENT_ID={Client ID} REDIRECT_URI={Redirect Uri} bats ./other_tests.bats
EOF
}

setup() {
  if [ -z "$HOST" ]; then
    echo "ERROR HOST is a required parameter."
    usage
    exit 0
  fi

  if [ -z "$TOKEN_FILE" ]; then
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

@test 'User Info happy path' {
  access_token=$(cat "$TOKEN_FILE" | jq ".access_token" | tr -d '"')

  curl -s \
    -H 'Accept: application/json' \
    -H "Authorization: Bearer ${access_token}" \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/userinfo" > "$curl_status"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq 'has("sub")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("name")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("locale")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("preferred_username")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("given_name")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("middle_name")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("family_name")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("zoneinfo")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("updated_at")')" == "true" ]
}

@test 'Keys happy path' {
  curl -s \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/keys" > "$curl_status"

cat "$curl_body"
  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq '.keys[0] | has("kty")')" == "true" ]
  [ "$(cat "$curl_body" | jq '.keys[0] | has("alg")')" == "true" ]
  [ "$(cat "$curl_body" | jq '.keys[0] | has("kid")')" == "true" ]
  [ "$(cat "$curl_body" | jq '.keys[0] | has("use")')" == "true" ]
  [ "$(cat "$curl_body" | jq '.keys[0] | has("e")')" == "true" ]
  [ "$(cat "$curl_body" | jq '.keys[0] | has("n")')" == "true" ]
}

@test 'Manage happy path' {
  curl -s \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/manage" > "$curl_status"

  [ "$(cat "$curl_status")" -eq 302 ]
}

@test 'Manage no path' {
  curl -s \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/noManage/manage" > "$curl_status"

  [ "$(cat "$curl_status")" -eq 404 ]
}

authorization() {
  local redirect_uri=$1
  response=$(curl -s \
    -Ls -w "%{url_effective}" -o "%{http_code}" \
    "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&redirect_uri=$redirect_uri&aud=default")
  echo $response
  return 0
}

@test 'Authorize Handler with no state parameter' {
  SCOPE="openid%20profile%20disability_rating.read%20service_history.read%20veteran_status.read%20offline_access"
  
  response=$(authorization $REDIRECT_URI)
  [ "$response" == "$REDIRECT_URI?error=invalid_request&error_description=State+parameter+required" ]
}

@test 'Authorize Handler with no redirect_uri' {
  curl -s \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&redirect_uri=&aud=default" > "$curl_status"

  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_request" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "There was no redirect URI specified by the application." ]
}

@test 'Authorize Handler with undefined redirect_uri' {
  curl -s \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/authorization?client_id=$CLIENT_ID&scope=$SCOPE&response_type=code&aud=default" > "$curl_status"

  [ "$(cat "$curl_status")" -eq 400 ]
  [ "$(cat "$curl_body" | jq .error | tr -d '"')" == "invalid_request" ]
  [ "$(cat "$curl_body" | jq .error_description | tr -d '"')" == "There was no redirect URI specified by the application." ]
}

@test 'Redirect Handler without a redirect_url that can be looked up' {
  curl -s \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/redirect?code=xxxsomecode&state=xxxxxxstatewithnoredirect" > "$curl_status"

  [ "$(cat "$curl_status")" -eq 400 ]
}

@test 'Metadata endpoint test' {
  curl -s \
    -w "%{http_code}" \
    -o "$curl_body" \
    "$HOST/.well-known/openid-configuration" > "$curl_status"

  [ "$(cat "$curl_status")" -eq 200 ]
  [ "$(cat "$curl_body" | jq 'has("issuer")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("authorization_endpoint")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("token_endpoint")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("userinfo_endpoint")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("introspection_endpoint")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("revocation_endpoint")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("jwks_uri")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("scopes_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("response_types_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("response_modes_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("grant_types_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("subject_types_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("id_token_signing_alg_values_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("token_endpoint_auth_methods_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("revocation_endpoint_auth_methods_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("claims_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("code_challenge_methods_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("introspection_endpoint_auth_methods_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("request_parameter_supported")')" == "true" ]
  [ "$(cat "$curl_body" | jq 'has("request_object_signing_alg_values_supported")')" == "true" ]
}