#!/usr/bin/env bash
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

REDIRECT_URI="https://app/after-auth"
pass=1

TOKEN_FILE="$(mktemp)"
EXPIRED_TOKEN="$(mktemp)"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Helper Functions

track_result() {
  if [[ "$?" -gt 0 ]]
  then
    pass=0
  fi
}

# --------

# Code and Token Utilities

assign_code() {
  local network=""
  if [[ $HOST == *"localhost"* ]];
  then
    network="-it --network container:oauth-proxy_oauth-proxy_1"
  else
    network=""
  fi

  local code
  code=$(docker run \
      $network \
      vasdvp/lighthouse-auth-utils:latest auth \
      --redirect-uri="$REDIRECT_URI" \
      --authorization-url="$HOST" \
      --user-email="$USER_EMAIL" \
      --user-password="$USER_PASSWORD" \
      --client-id="$CLIENT_ID" \
      --client-secret="$CLIENT_SECRET" \
      --code-only)

  local CODE
  CODE=$(echo "$code" | jq ".code" | tr -d '"')

  if [[ -z $CODE ]];
  then
    echo -e "\nFailed to retrieve code."
    echo "This is likely a lighthouse-auth-utilities bot issue."
    echo "Check for valid configuration."
    echo "Exiting ... "
    exit 1
  fi
  echo "$CODE"
}

# ----

# Pulling latest lighthouse-auth-utils docker image if necessary
docker pull vasdvp/lighthouse-auth-utils:latest

CODE=$(assign_code)

# Start Tests

"$DIR"/token_tests.sh "$HOST" "$CODE" "$TOKEN_FILE" "$EXPIRED_TOKEN"
track_result
"$DIR"/introspect_tests.sh --host="$HOST" --tokens="$( cat "$TOKEN_FILE")" --expired-access="$( cat "$EXPIRED_TOKEN")"
track_result
"$DIR"/okta_grants_tests.sh --host="$HOST"
track_result
"$DIR"/other_tests.sh "$HOST" "$( cat "$TOKEN_FILE")"
track_result

# End of Tests ----

if [[ "$pass" -gt 0 ]];
then
  echo "All tests passed!"
  exit 0
fi

echo "Some tests failed."
exit 1