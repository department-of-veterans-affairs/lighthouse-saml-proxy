#!/usr/bin/env bash
# Team Pivot!
# Simple script to test the Oauth Proxy.

usage() {
cat <<EOF
Runs e2e Oauth Proxy regression tests.

Example
  export USER_EMAIL=va.api.user+idme.001@gmail.com
  export USER_PASSWORD=Password1234!
  export CLIENT_ID={{ client id }}
  export CLIENT_SECRET={{ client secret }}
  export HOST=https://sandbox-api.va.gov/oauth2
  export CC_CLIENT_ID={{ client id }}
  export CC_CLIENT_SECRET={{ client secret }}

  ./regression_tests.sh
EOF
exit 1
}

for i in "$@"
do
case $i in
    
    --help|-h)
      usage ;  exit 1 ;;
    --) shift ; break ;;
    *) usage ; exit 1 ;;
esac
done

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

if [ -z "$USER_EMAIL" ];
then
  echo "ERROR - USER_EMAIL is a required parameter."
  exit 1
fi

if [ -z "$USER_PASSWORD" ];
then
  echo "ERROR - USER_PASSWORD is a required parameter."
  exit 1
fi

if [ -z "$CLIENT_ID" ];
then
  echo "ERROR - CLIENT_ID is a required parameter."
  exit 1
fi

if [ -z "$CLIENT_SECRET" ];
then
  echo "ERROR - CLIENT_SECRET is a required parameter."
  exit 1
fi

if [ -z "$HOST" ];
then
  echo "ERROR - HOST is a required parameter."
  exit 1
fi

if [ -z "$CC_CLIENT_ID" ];
then
  echo "ERROR - CC_CLIENT_ID is a required parameter."
  exit 1
fi

if [ -z "$CC_CLIENT_SECRET" ];
then
  echo "ERROR - CC_CLIENT_SECRET is a required parameter."
  exit 1
fi

# Variables

export REDIRECT_URI="https://app/after-auth"
pass=1

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
      vasdvp/lighthouse-auth-utils:1.1.2 auth \
      --redirect-uri="$REDIRECT_URI" \
      --authorization-url="$HOST" \
      --user-email="$USER_EMAIL" \
      --user-password="$USER_PASSWORD" \
      --client-id="$CLIENT_ID" \
      --client-secret="$CLIENT_SECRET" \
      --grant_consent="true" \
      --scope="openid profile offline_access email address phone launch/patient" \
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
docker pull vasdvp/lighthouse-auth-utils:1.1.2

# Start Tests

"$DIR"/okta_grants_tests.sh --host="$HOST"
track_result

echo "Fetching code ..."
CODE=$(assign_code)

. "$DIR"/token_tests.sh --host="$HOST" --code="$CODE"
track_result
# TOKEN and EXPIRED_ACCESS are assigned in token_tests.sh
"$DIR"/introspect_tests.sh --host="$HOST" --tokens="$TOKEN" --expired-access="$EXPIRED_ACCESS"
track_result
"$DIR"/other_tests.sh --host="$HOST" --tokens="$TOKEN"
track_result

# End of Tests ----

if [[ "$pass" -gt 0 ]];
then
  echo "All tests passed!"
  exit 0
fi

echo "Some tests failed."
exit 1
